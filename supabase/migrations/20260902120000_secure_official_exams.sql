-- Security hardening and server-authoritative official exams.

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('student', 'admin'));

create or replace function public.guard_profile_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if tg_op = 'INSERT' then
      -- The server, rather than the caller, assigns the initial role.
      new.role := 'student';
    elsif new.role is distinct from old.role then
      raise exception using
        errcode = '42501',
        message = 'Somente o serviço administrativo pode alterar o papel de um usuário.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_profile_role() from public;
grant execute on function public.guard_profile_role() to authenticated, service_role;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
before insert or update of role on public.profiles
for each row execute function public.guard_profile_role();

-- Authenticated users can create their own profile and maintain ordinary profile
-- fields, but cannot name or mutate a role at the SQL privilege layer.
revoke insert, update on table public.profiles from authenticated;
grant insert (id, name, email, preferences) on table public.profiles to authenticated;
grant update (name, email, preferences) on table public.profiles to authenticated;

alter table public.question_options
  add column if not exists error_type text,
  add column if not exists prerequisite_id text;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'question_options_prerequisite_id_fkey'
      and conrelid = 'public.question_options'::regclass
  ) then
    alter table public.question_options
      add constraint question_options_prerequisite_id_fkey
      foreign key (prerequisite_id)
      references public.prerequisites(id)
      on delete set null
      not valid;
  end if;
end;
$$;

-- Preserve the former question-level diagnosis for existing rows. Future seeds
-- can provide a distinct misconception and prerequisite for each distractor.
update public.question_options as option
set
  error_type = case
    when option.id = question.correct_option_id then null
    else coalesce(option.error_type, question.error_type)
  end,
  prerequisite_id = case
    when option.id = question.correct_option_id then null
    else coalesce(
      option.prerequisite_id,
      (
        select question_prerequisite.prerequisite_id
        from public.question_prerequisites as question_prerequisite
        where question_prerequisite.question_id = question.id
        order by question_prerequisite.prerequisite_id
        limit 1
      )
    )
  end
from public.questions as question
where question.id = option.question_id;

-- Schedule, score, count and timing invariants.
alter table public.assessment_schedules
  drop constraint if exists assessment_schedules_question_count_check,
  drop constraint if exists assessment_schedules_minimum_score_check,
  drop constraint if exists assessment_schedules_max_attempts_check,
  drop constraint if exists assessment_schedules_window_check,
  drop constraint if exists assessment_schedules_deadline_policy_check,
  drop constraint if exists assessment_schedules_scope_check;

alter table public.assessment_schedules
  add constraint assessment_schedules_question_count_check
    check (question_count > 0),
  add constraint assessment_schedules_minimum_score_check
    check (minimum_score between 0 and 100),
  add constraint assessment_schedules_max_attempts_check
    check (max_attempts > 0),
  add constraint assessment_schedules_window_check
    check (available_at < due_at),
  add constraint assessment_schedules_deadline_policy_check
    check (deadline_policy in ('expire', 'late', 'available')),
  add constraint assessment_schedules_scope_check
    check (scope in ('topic', 'module', 'course', 'scheduled'));

alter table public.official_exam_attempts
  drop constraint if exists official_exam_attempts_score_check,
  drop constraint if exists official_exam_attempts_correct_count_check,
  drop constraint if exists official_exam_attempts_question_count_check,
  drop constraint if exists official_exam_attempts_question_ids_check,
  drop constraint if exists official_exam_attempts_time_limit_check,
  drop constraint if exists official_exam_attempts_time_spent_check;

alter table public.official_exam_attempts
  add constraint official_exam_attempts_score_check
    check (score between 0 and 100),
  add constraint official_exam_attempts_correct_count_check
    check (correct_count between 0 and question_count),
  add constraint official_exam_attempts_question_count_check
    check (question_count > 0),
  add constraint official_exam_attempts_question_ids_check
    check (
      jsonb_typeof(question_ids) = 'array'
      and jsonb_array_length(question_ids) = question_count
    ),
  add constraint official_exam_attempts_time_limit_check
    check (time_limit_seconds > 0),
  add constraint official_exam_attempts_time_spent_check
    check (time_spent_seconds >= 0);

alter table public.official_exam_answers
  alter column selected_option_id drop not null,
  drop constraint if exists official_exam_answers_time_spent_check;

alter table public.official_exam_answers
  add constraint official_exam_answers_time_spent_check
    check (time_spent_seconds >= 0);

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'official_exam_attempts_assessment_id_fkey'
      and conrelid = 'public.official_exam_attempts'::regclass
  ) then
    alter table public.official_exam_attempts
      add constraint official_exam_attempts_assessment_id_fkey
      foreign key (assessment_id)
      references public.assessment_schedules(id)
      on delete restrict
      not valid;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'official_exam_answers_selected_option_fkey'
      and conrelid = 'public.official_exam_answers'::regclass
  ) then
    alter table public.official_exam_answers
      add constraint official_exam_answers_selected_option_fkey
      foreign key (question_id, selected_option_id)
      references public.question_options(question_id, id)
      on delete restrict
      not valid;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'official_exam_answers_question_id_fkey'
      and conrelid = 'public.official_exam_answers'::regclass
  ) then
    alter table public.official_exam_answers
      add constraint official_exam_answers_question_id_fkey
      foreign key (question_id)
      references public.questions(id)
      on delete restrict
      not valid;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'official_exam_answers_correct_option_fkey'
      and conrelid = 'public.official_exam_answers'::regclass
  ) then
    alter table public.official_exam_answers
      add constraint official_exam_answers_correct_option_fkey
      foreign key (question_id, correct_option_id)
      references public.question_options(question_id, id)
      on delete restrict
      not valid;
  end if;

end;
$$;

-- Retain the most recent copy if legacy client retries created duplicates, then
-- make one answer per question an invariant.
with ranked_answers as (
  select
    id,
    row_number() over (
      partition by attempt_id, question_id
      order by answered_at desc, id desc
    ) as duplicate_rank
  from public.official_exam_answers
)
delete from public.official_exam_answers as answer
using ranked_answers
where answer.id = ranked_answers.id
  and ranked_answers.duplicate_rank > 1;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'official_exam_answers_attempt_question_key'
      and conrelid = 'public.official_exam_answers'::regclass
  ) then
    alter table public.official_exam_answers
      add constraint official_exam_answers_attempt_question_key
      unique (attempt_id, question_id);
  end if;
end;
$$;

-- Answer keys are not readable through the data API. Official exam functions
-- below run as their owner and return only the fields appropriate to each phase.
drop policy if exists "questions_read_authenticated" on public.questions;
drop policy if exists "question_options_read_authenticated" on public.question_options;
revoke select on table public.questions, public.question_options from authenticated, anon;

drop policy if exists "official_exam_attempts_insert_own" on public.official_exam_attempts;
drop policy if exists "official_exam_attempts_update_own" on public.official_exam_attempts;
drop policy if exists "official_exam_attempts_delete_own" on public.official_exam_attempts;
drop policy if exists "official_exam_answers_insert_own" on public.official_exam_answers;
drop policy if exists "official_exam_answers_update_own" on public.official_exam_answers;
drop policy if exists "official_exam_answers_delete_own" on public.official_exam_answers;

revoke insert, update, delete, truncate
  on table public.official_exam_attempts, public.official_exam_answers
  from authenticated, anon;

drop policy if exists "official_exam_attempts_select_own" on public.official_exam_attempts;
create policy "official_exam_attempts_select_own" on public.official_exam_attempts
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "official_exam_answers_select_own" on public.official_exam_answers;
create policy "official_exam_answers_select_own" on public.official_exam_answers
  for select to authenticated
  using (auth.uid() = user_id);

create or replace function public.start_official_exam(p_assessment_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_assessment public.assessment_schedules%rowtype;
  v_attempt public.official_exam_attempts%rowtype;
  v_attempt_count integer;
  v_question_ids text[] := array[]::text[];
  v_picked_ids text[];
  v_questions jsonb;
  v_attempt_json jsonb;
  v_mix_key text;
  v_mix_value jsonb;
  v_requested_basic integer := 0;
  v_requested_medium integer := 0;
  v_requested_advanced integer := 0;
  v_requested_total integer := 0;
  v_requested integer;
  v_difficulty public.difficulty;
  v_candidate_count integer;
  v_time_basic integer;
  v_time_medium integer;
  v_time_advanced integer;
  v_base_minutes integer;
  v_has_advanced_context boolean;
  v_time_limit_seconds integer;
begin
  if v_user_id is null then
    raise exception using
      errcode = '28000',
      message = 'Autenticação obrigatória para iniciar uma prova oficial.';
  end if;

  if p_assessment_id is null or pg_catalog.btrim(p_assessment_id) = '' then
    raise exception using
      errcode = '22023',
      message = 'Informe uma avaliação válida.';
  end if;

  -- Serializes starts for one user, preventing concurrent calls from bypassing
  -- max_attempts without requiring a client-visible lock table.
  perform 1
  from public.profiles as profile
  where profile.id = v_user_id
  for update;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'O perfil autenticado não existe.';
  end if;

  select schedule.*
  into v_assessment
  from public.assessment_schedules as schedule
  where schedule.id = p_assessment_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Avaliação oficial não encontrada.';
  end if;

  if not v_assessment.active then
    raise exception using
      errcode = '55000',
      message = 'Esta avaliação está desativada.';
  end if;

  if v_now < v_assessment.available_at then
    raise exception using
      errcode = '55000',
      message = 'Esta avaliação ainda não está disponível.';
  end if;

  if v_now > v_assessment.due_at
     and v_assessment.deadline_policy = 'expire' then
    raise exception using
      errcode = '55000',
      message = 'O prazo desta avaliação expirou.';
  end if;

  select attempt.*
  into v_attempt
  from public.official_exam_attempts as attempt
  where attempt.user_id = v_user_id
    and attempt.assessment_id = p_assessment_id
    and attempt.status = 'in_progress'
  order by attempt.started_at desc
  limit 1
  for update;

  if not found then
    select count(*)::integer
    into v_attempt_count
    from public.official_exam_attempts as attempt
    where attempt.user_id = v_user_id
      and attempt.assessment_id = p_assessment_id
      and attempt.status <> 'in_progress';

    if v_attempt_count >= v_assessment.max_attempts then
      raise exception using
        errcode = '54000',
        message = 'Você atingiu o limite de tentativas desta avaliação.';
    end if;

    if pg_catalog.jsonb_typeof(v_assessment.difficulty_mix) <> 'object' then
      raise exception using
        errcode = '22023',
        message = 'Configuração inválida: difficulty_mix deve ser um objeto.';
    end if;

    for v_mix_key, v_mix_value in
      select mix.key, mix.value
      from pg_catalog.jsonb_each(v_assessment.difficulty_mix) as mix
    loop
      if v_mix_key not in ('basico', 'medio', 'avancado')
         or pg_catalog.jsonb_typeof(v_mix_value) <> 'number'
         or v_mix_value::text !~ '^[0-9]+$' then
        raise exception using
          errcode = '22023',
          message = 'Configuração inválida: difficulty_mix aceita somente inteiros não negativos para basico, medio e avancado.';
      end if;

      if v_mix_key = 'basico' then
        v_requested_basic := (v_mix_value::text)::integer;
      elsif v_mix_key = 'medio' then
        v_requested_medium := (v_mix_value::text)::integer;
      else
        v_requested_advanced := (v_mix_value::text)::integer;
      end if;
    end loop;

    v_requested_total :=
      v_requested_basic + v_requested_medium + v_requested_advanced;

    if v_requested_total <> v_assessment.question_count then
      raise exception using
        errcode = '22023',
        message = 'Configuração inválida: a soma de difficulty_mix deve ser igual a question_count.';
    end if;

    select count(*)::integer
    into v_candidate_count
    from public.questions as question
    where question.course_id = v_assessment.course_id
      and question.topic_id = v_assessment.topic_id;

    if v_candidate_count < v_assessment.question_count then
      raise exception using
        errcode = 'P0001',
        message = pg_catalog.format(
          'Banco insuficiente para %s/%s: são necessárias %s questões do mesmo curso e tópico, mas há %s.',
          v_assessment.course_id,
          v_assessment.topic_id,
          v_assessment.question_count,
          v_candidate_count
        );
    end if;

    for v_difficulty, v_requested in
      select requested_mix.difficulty, requested_mix.requested
      from (
        values
          ('basico'::public.difficulty, v_requested_basic),
          ('medio'::public.difficulty, v_requested_medium),
          ('avancado'::public.difficulty, v_requested_advanced)
      ) as requested_mix(difficulty, requested)
    loop
      if v_requested = 0 then
        continue;
      end if;

      select coalesce(
        pg_catalog.array_agg(candidate.id),
        array[]::text[]
      )
      into v_picked_ids
      from (
        select question.id
        from public.questions as question
        where question.course_id = v_assessment.course_id
          and question.topic_id = v_assessment.topic_id
          and question.difficulty = v_difficulty
        order by pg_catalog.random()
        limit v_requested
      ) as candidate;

      if pg_catalog.cardinality(v_picked_ids) <> v_requested then
        raise exception using
          errcode = 'P0001',
          message = pg_catalog.format(
            'Banco insuficiente: a avaliação exige %s questão(ões) de dificuldade %s no tópico %s.',
            v_requested,
            v_difficulty,
            v_assessment.topic_id
          );
      end if;

      v_question_ids := v_question_ids || v_picked_ids;
    end loop;

    begin
      v_time_basic := coalesce(
        nullif(v_assessment.time_settings ->> 'basico', '')::integer,
        2
      );
      v_time_medium := coalesce(
        nullif(v_assessment.time_settings ->> 'medio', '')::integer,
        4
      );
      v_time_advanced := coalesce(
        nullif(v_assessment.time_settings ->> 'avancado', '')::integer,
        7
      );
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception using
        errcode = '22023',
        message = 'Configuração inválida: time_settings deve conter minutos inteiros positivos.';
    end;

    if v_time_basic <= 0 or v_time_medium <= 0 or v_time_advanced <= 0 then
      raise exception using
        errcode = '22023',
        message = 'Configuração inválida: time_settings deve conter minutos inteiros positivos.';
    end if;

    select
      coalesce(
        sum(
          case question.difficulty
            when 'basico' then v_time_basic
            when 'medio' then v_time_medium
            when 'avancado' then v_time_advanced
          end
        ),
        0
      )::integer,
      coalesce(
        bool_or(
          question.difficulty = 'avancado'
          or question.course_id in ('calculo-3', 'calculo-4')
        ),
        false
      )
    into v_base_minutes, v_has_advanced_context
    from public.questions as question
    where question.id = any(v_question_ids);

    v_time_limit_seconds := greatest(
      15,
      case
        when v_has_advanced_context
          then pg_catalog.ceil(v_base_minutes::numeric * 1.15)::integer
        else v_base_minutes
      end
    ) * 60;

    insert into public.official_exam_attempts (
      user_id,
      assessment_id,
      course_id,
      topic_id,
      status,
      score,
      correct_count,
      question_count,
      question_ids,
      time_limit_seconds,
      time_spent_seconds,
      started_at,
      submitted_at
    ) values (
      v_user_id,
      v_assessment.id,
      v_assessment.course_id,
      v_assessment.topic_id,
      'in_progress',
      0,
      0,
      v_assessment.question_count,
      pg_catalog.to_jsonb(v_question_ids),
      v_time_limit_seconds,
      0,
      v_now,
      null
    )
    returning * into v_attempt;
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', question.id,
        'courseId', question.course_id,
        'topicId', question.topic_id,
        'prerequisiteIds', coalesce(
          (
            select pg_catalog.jsonb_agg(
              question_prerequisite.prerequisite_id
              order by question_prerequisite.prerequisite_id
            )
            from public.question_prerequisites as question_prerequisite
            where question_prerequisite.question_id = question.id
          ),
          '[]'::jsonb
        ),
        'prompt', question.prompt,
        'options', coalesce(
          (
            select pg_catalog.jsonb_agg(
              pg_catalog.jsonb_build_object('id', option.id, 'text', option.text)
              order by option."order"
            )
            from public.question_options as option
            where option.question_id = question.id
          ),
          '[]'::jsonb
        ),
        'difficulty', question.difficulty,
        'tags', question.tags
      )
      order by selected_question.ordinality
    ),
    '[]'::jsonb
  )
  into v_questions
  from pg_catalog.jsonb_array_elements_text(v_attempt.question_ids)
    with ordinality as selected_question(question_id, ordinality)
  join public.questions as question
    on question.id = selected_question.question_id
  where question.course_id = v_attempt.course_id
    and question.topic_id = v_attempt.topic_id;

  if pg_catalog.jsonb_array_length(v_questions) <> v_attempt.question_count then
    raise exception using
      errcode = '23514',
      message = 'A tentativa contém questões ausentes ou fora do curso/tópico configurado.';
  end if;

  v_attempt_json := pg_catalog.jsonb_build_object(
    'id', v_attempt.id,
    'assessmentId', v_attempt.assessment_id,
    'courseId', v_attempt.course_id,
    'topicId', v_attempt.topic_id,
    'status', v_attempt.status,
    'score', v_attempt.score,
    'correctCount', v_attempt.correct_count,
    'questionCount', v_attempt.question_count,
    'timeLimitSeconds', v_attempt.time_limit_seconds,
    'timeSpentSeconds', v_attempt.time_spent_seconds,
    'questionIds', v_attempt.question_ids,
    'startedAt', v_attempt.started_at,
    'submittedAt', v_attempt.submitted_at,
    'createdAt', v_attempt.created_at
  );

  return pg_catalog.jsonb_build_object(
    'attempt', v_attempt_json,
    'questions', v_questions
  );
end;
$$;

create or replace function public.submit_official_exam(
  p_attempt_id uuid,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_attempt public.official_exam_attempts%rowtype;
  v_assessment public.assessment_schedules%rowtype;
  v_status public.exam_attempt_status;
  v_elapsed_seconds integer;
  v_submission_cutoff timestamptz;
  v_correct_count integer;
  v_score integer;
  v_inserted_count integer;
  v_answers jsonb;
  v_attempt_json jsonb;
begin
  if v_user_id is null then
    raise exception using
      errcode = '28000',
      message = 'Autenticação obrigatória para entregar uma prova oficial.';
  end if;

  if p_attempt_id is null then
    raise exception using
      errcode = '22023',
      message = 'Informe uma tentativa válida.';
  end if;

  select attempt.*
  into v_attempt
  from public.official_exam_attempts as attempt
  where attempt.id = p_attempt_id
    and attempt.user_id = v_user_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Tentativa não encontrada ou pertencente a outro usuário.';
  end if;

  if v_attempt.status <> 'in_progress' then
    raise exception using
      errcode = '55000',
      message = 'Esta tentativa já foi finalizada.';
  end if;

  select schedule.*
  into v_assessment
  from public.assessment_schedules as schedule
  where schedule.id = v_attempt.assessment_id
  for share;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'A configuração desta avaliação não existe mais.';
  end if;

  if p_answers is null or pg_catalog.jsonb_typeof(p_answers) <> 'object' then
    raise exception using
      errcode = '22023',
      message = 'As respostas devem ser um objeto JSON no formato questionId: { optionId, timeSpentSeconds }.';
  end if;

  if (
    select count(*)
    from pg_catalog.jsonb_object_keys(p_answers)
  ) <> v_attempt.question_count then
    raise exception using
      errcode = '22023',
      message = 'Envie exatamente uma resposta para cada questão da tentativa.';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_object_keys(p_answers) as submitted(question_id)
    where not (
      v_attempt.question_ids
      @> pg_catalog.jsonb_build_array(submitted.question_id)
    )
  ) then
    raise exception using
      errcode = '22023',
      message = 'As respostas contêm uma questão que não pertence à tentativa.';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements_text(v_attempt.question_ids)
      as expected(question_id)
    where not (p_answers ? expected.question_id)
  ) then
    raise exception using
      errcode = '22023',
      message = 'Todas as questões da tentativa devem ser respondidas.';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_each(p_answers) as submitted(question_id, answer_value)
    where pg_catalog.jsonb_typeof(submitted.answer_value) <> 'object'
      or not (submitted.answer_value ? 'optionId')
      or pg_catalog.jsonb_typeof(submitted.answer_value -> 'optionId')
        not in ('string', 'null')
      or (
        pg_catalog.jsonb_typeof(submitted.answer_value -> 'optionId') = 'string'
        and pg_catalog.btrim(submitted.answer_value ->> 'optionId') = ''
      )
      or not (submitted.answer_value ? 'timeSpentSeconds')
      or pg_catalog.jsonb_typeof(submitted.answer_value -> 'timeSpentSeconds')
        <> 'number'
      or (submitted.answer_value -> 'timeSpentSeconds')::text !~ '^[0-9]+$'
      or submitted.answer_value - array['optionId', 'timeSpentSeconds']
        <> '{}'::jsonb
      or (
        pg_catalog.jsonb_typeof(submitted.answer_value -> 'optionId') = 'string'
        and not exists (
        select 1
        from public.question_options as option
        where option.question_id = submitted.question_id
          and option.id = submitted.answer_value ->> 'optionId'
        )
      )
  ) then
    raise exception using
      errcode = '22023',
      message = 'Cada resposta deve conter somente optionId válido e timeSpentSeconds inteiro não negativo.';
  end if;

  v_elapsed_seconds := least(
    2147483647,
    greatest(
      0,
      pg_catalog.floor(
        pg_catalog.extract(epoch from (v_now - v_attempt.started_at))
      )::bigint
    )
  )::integer;

  if (
    select coalesce(
      sum((submitted.answer_value ->> 'timeSpentSeconds')::numeric),
      0
    )
    from pg_catalog.jsonb_each(p_answers)
      as submitted(question_id, answer_value)
  ) > least(v_attempt.time_limit_seconds, v_elapsed_seconds + 30) then
    raise exception using
      errcode = '22023',
      message = 'O tempo por questão não pode exceder o tempo real da tentativa.';
  end if;

  -- A client cannot extend the clock. The individual duration always applies;
  -- an `expire` schedule additionally caps the attempt at due_at. `late` and
  -- `available` preserve their documented after-deadline semantics. Thirty
  -- seconds cover only network/transaction latency, never a client timestamp.
  v_submission_cutoff := v_attempt.started_at
    + pg_catalog.make_interval(secs => v_attempt.time_limit_seconds);

  if v_assessment.deadline_policy = 'expire' then
    v_submission_cutoff := least(v_submission_cutoff, v_assessment.due_at);
  end if;

  if v_now > v_submission_cutoff + interval '30 seconds'
     or (
       v_now > v_assessment.due_at
       and v_assessment.deadline_policy = 'expire'
     ) then
    v_status := 'expired';
  elsif v_now > v_assessment.due_at
        and v_assessment.deadline_policy = 'late' then
    v_status := 'late';
  else
    v_status := 'submitted';
  end if;

  delete from public.official_exam_answers as answer
  where answer.attempt_id = v_attempt.id;

  with submitted_answers as (
    select
      submitted.question_id,
      case
        when pg_catalog.jsonb_typeof(submitted.answer_value -> 'optionId') = 'null'
          then null
        else submitted.answer_value ->> 'optionId'
      end as selected_option_id,
      least(
        (submitted.answer_value ->> 'timeSpentSeconds')::numeric,
        v_attempt.time_limit_seconds::numeric
      )::integer as time_spent_seconds
    from pg_catalog.jsonb_each(p_answers)
      as submitted(question_id, answer_value)
  ),
  attempt_questions as (
    select selected.question_id, selected.ordinality
    from pg_catalog.jsonb_array_elements_text(v_attempt.question_ids)
      with ordinality as selected(question_id, ordinality)
  )
  insert into public.official_exam_answers (
    attempt_id,
    user_id,
    question_id,
    course_id,
    topic_id,
    prerequisite_ids,
    selected_option_id,
    correct_option_id,
    correct,
    time_spent_seconds,
    difficulty,
    error_type,
    answered_at
  )
  select
    v_attempt.id,
    v_user_id,
    question.id,
    question.course_id,
    question.topic_id,
    case
      when submitted.selected_option_id <> question.correct_option_id
           and selected_option.prerequisite_id is not null
        then pg_catalog.jsonb_build_array(selected_option.prerequisite_id)
      else coalesce(
        (
          select pg_catalog.jsonb_agg(
            question_prerequisite.prerequisite_id
            order by question_prerequisite.prerequisite_id
          )
          from public.question_prerequisites as question_prerequisite
          where question_prerequisite.question_id = question.id
        ),
        '[]'::jsonb
      )
    end,
    submitted.selected_option_id,
    question.correct_option_id,
    coalesce(submitted.selected_option_id = question.correct_option_id, false),
    submitted.time_spent_seconds,
    question.difficulty,
    case
      when submitted.selected_option_id is null
        then 'Questão não respondida'
      when submitted.selected_option_id = question.correct_option_id
        then 'acerto'
      else coalesce(
        selected_option.error_type,
        question.error_type,
        'Erro não classificado'
      )
    end,
    v_now
  from attempt_questions
  join public.questions as question
    on question.id = attempt_questions.question_id
  left join submitted_answers as submitted
    on submitted.question_id = question.id
  left join public.question_options as selected_option
    on selected_option.question_id = question.id
   and selected_option.id = submitted.selected_option_id
  order by attempt_questions.ordinality;

  get diagnostics v_inserted_count = row_count;

  if v_inserted_count <> v_attempt.question_count then
    raise exception using
      errcode = '23514',
      message = 'Não foi possível corrigir todas as questões da tentativa.';
  end if;

  select count(*)::integer
  into v_correct_count
  from public.official_exam_answers as answer
  where answer.attempt_id = v_attempt.id
    and answer.correct;

  v_score := pg_catalog.round(
    (v_correct_count::numeric / v_attempt.question_count::numeric) * 100
  )::integer;

  update public.official_exam_attempts as attempt
  set
    status = v_status,
    score = v_score,
    correct_count = v_correct_count,
    time_spent_seconds = v_elapsed_seconds,
    submitted_at = v_now
  where attempt.id = v_attempt.id
  returning * into v_attempt;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'questionId', answer.question_id,
        'selectedOptionId', answer.selected_option_id,
        'correctOptionId', answer.correct_option_id,
        'correct', answer.correct,
        'timeSpentSeconds', answer.time_spent_seconds,
        'explanation', question.explanation,
        'errorType', answer.error_type,
        'prerequisiteIds', answer.prerequisite_ids
      )
      order by selected_question.ordinality
    ),
    '[]'::jsonb
  )
  into v_answers
  from pg_catalog.jsonb_array_elements_text(v_attempt.question_ids)
    with ordinality as selected_question(question_id, ordinality)
  join public.official_exam_answers as answer
    on answer.attempt_id = v_attempt.id
   and answer.question_id = selected_question.question_id
  join public.questions as question
    on question.id = answer.question_id;

  v_attempt_json := pg_catalog.jsonb_build_object(
    'id', v_attempt.id,
    'assessmentId', v_attempt.assessment_id,
    'courseId', v_attempt.course_id,
    'topicId', v_attempt.topic_id,
    'status', v_attempt.status,
    'score', v_attempt.score,
    'correctCount', v_attempt.correct_count,
    'questionCount', v_attempt.question_count,
    'timeLimitSeconds', v_attempt.time_limit_seconds,
    'timeSpentSeconds', v_attempt.time_spent_seconds,
    'questionIds', v_attempt.question_ids,
    'startedAt', v_attempt.started_at,
    'submittedAt', v_attempt.submitted_at,
    'createdAt', v_attempt.created_at
  );

  return pg_catalog.jsonb_build_object(
    'attempt', v_attempt_json,
    'answers', v_answers,
    'score', v_score,
    'correctCount', v_correct_count
  );
end;
$$;

revoke all on function public.start_official_exam(text) from public, anon;
revoke all on function public.submit_official_exam(uuid, jsonb) from public, anon;
grant execute on function public.start_official_exam(text) to authenticated;
grant execute on function public.submit_official_exam(uuid, jsonb) to authenticated;
