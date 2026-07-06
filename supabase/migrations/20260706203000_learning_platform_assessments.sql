alter table public.profiles
  add column if not exists role text not null default 'student';

do $$ begin
  create type public.exam_attempt_status as enum (
    'in_progress',
    'submitted',
    'expired',
    'late'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.assessment_schedules (
  id text primary key,
  title text not null,
  description text not null,
  course_id public.course_id not null references public.courses(id) on delete cascade,
  topic_id text not null references public.topics(id) on delete cascade,
  scope text not null,
  question_count integer not null,
  difficulty_mix jsonb not null default '{}'::jsonb,
  minimum_score integer not null default 70,
  max_attempts integer not null default 3,
  available_at timestamptz not null,
  due_at timestamptz not null,
  deadline_policy text not null default 'late',
  required boolean not null default true,
  active boolean not null default true,
  time_settings jsonb not null default '{"basico":2,"medio":4,"avancado":7}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.official_exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  assessment_id text not null,
  course_id public.course_id not null,
  topic_id text not null,
  status public.exam_attempt_status not null default 'in_progress',
  score integer not null default 0,
  correct_count integer not null default 0,
  question_count integer not null default 0,
  question_ids jsonb not null default '[]'::jsonb,
  time_limit_seconds integer not null,
  time_spent_seconds integer not null default 0,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists official_exam_attempts_user_created_at_idx
  on public.official_exam_attempts (user_id, created_at desc);

create table if not exists public.official_exam_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.official_exam_attempts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id text not null,
  course_id public.course_id not null,
  topic_id text not null,
  prerequisite_ids jsonb not null default '[]'::jsonb,
  selected_option_id text not null,
  correct_option_id text not null,
  correct boolean not null,
  time_spent_seconds integer not null default 0,
  difficulty public.difficulty not null,
  error_type text not null,
  answered_at timestamptz not null default now()
);

create index if not exists official_exam_answers_user_answered_at_idx
  on public.official_exam_answers (user_id, answered_at desc);

alter table public.assessment_schedules enable row level security;
alter table public.official_exam_attempts enable row level security;
alter table public.official_exam_answers enable row level security;

drop policy if exists "assessment_schedules_read_authenticated" on public.assessment_schedules;
drop policy if exists "assessment_schedules_admin_insert" on public.assessment_schedules;
drop policy if exists "assessment_schedules_admin_update" on public.assessment_schedules;
drop policy if exists "assessment_schedules_admin_delete" on public.assessment_schedules;
create policy "assessment_schedules_read_authenticated" on public.assessment_schedules
  for select to authenticated using (active = true);
create policy "assessment_schedules_admin_insert" on public.assessment_schedules
  for insert to authenticated with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
create policy "assessment_schedules_admin_update" on public.assessment_schedules
  for update to authenticated using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  ) with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
create policy "assessment_schedules_admin_delete" on public.assessment_schedules
  for delete to authenticated using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

drop policy if exists "official_exam_attempts_select_own" on public.official_exam_attempts;
drop policy if exists "official_exam_attempts_insert_own" on public.official_exam_attempts;
drop policy if exists "official_exam_attempts_update_own" on public.official_exam_attempts;
create policy "official_exam_attempts_select_own" on public.official_exam_attempts
  for select using (auth.uid() = user_id);
create policy "official_exam_attempts_insert_own" on public.official_exam_attempts
  for insert with check (auth.uid() = user_id);
create policy "official_exam_attempts_update_own" on public.official_exam_attempts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "official_exam_answers_select_own" on public.official_exam_answers;
drop policy if exists "official_exam_answers_insert_own" on public.official_exam_answers;
create policy "official_exam_answers_select_own" on public.official_exam_answers
  for select using (auth.uid() = user_id);
create policy "official_exam_answers_insert_own" on public.official_exam_answers
  for insert with check (auth.uid() = user_id);
