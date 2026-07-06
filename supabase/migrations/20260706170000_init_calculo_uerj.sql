do $$ begin
  create type public.course_id as enum (
    'pre-calculo',
    'calculo-1',
    'calculo-2',
    'calculo-3',
    'calculo-4'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.difficulty as enum ('basico', 'medio', 'avancado');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.recommendation_priority as enum ('alta', 'media', 'baixa');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id public.course_id primary key,
  title text not null,
  short_title text not null,
  description text not null,
  "order" integer not null
);

create table if not exists public.topics (
  id text primary key,
  course_id public.course_id not null references public.courses(id) on delete cascade,
  title text not null,
  description text not null,
  "order" integer not null,
  outcomes jsonb not null default '[]'::jsonb
);

create table if not exists public.prerequisites (
  id text primary key,
  title text not null,
  description text not null,
  examples jsonb not null default '[]'::jsonb
);

create table if not exists public.prerequisite_topics (
  prerequisite_id text not null references public.prerequisites(id) on delete cascade,
  topic_id text not null references public.topics(id) on delete cascade,
  primary key (prerequisite_id, topic_id)
);

create table if not exists public.questions (
  id text primary key,
  course_id public.course_id not null references public.courses(id) on delete cascade,
  topic_id text not null references public.topics(id) on delete cascade,
  prompt text not null,
  correct_option_id text not null,
  explanation text not null,
  difficulty public.difficulty not null,
  error_type text not null,
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.question_options (
  question_id text not null references public.questions(id) on delete cascade,
  id text not null,
  text text not null,
  "order" integer not null,
  primary key (question_id, id)
);

create table if not exists public.question_prerequisites (
  question_id text not null references public.questions(id) on delete cascade,
  prerequisite_id text not null references public.prerequisites(id) on delete cascade,
  primary key (question_id, prerequisite_id)
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id text not null,
  course_id public.course_id not null,
  topic_id text not null,
  prerequisite_ids jsonb not null default '[]'::jsonb,
  selected_option_id text not null,
  correct_option_id text not null,
  correct boolean not null,
  time_spent_seconds integer not null,
  difficulty public.difficulty not null,
  error_type text not null,
  created_at timestamptz not null default now()
);

create index if not exists attempts_user_created_at_idx
  on public.attempts (user_id, created_at desc);

create table if not exists public.imported_questions (
  id text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  question jsonb not null,
  created_at timestamptz not null default now(),
  primary key (id, user_id)
);

create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null,
  action_label text not null,
  course_id public.course_id not null,
  topic_id text not null,
  priority public.recommendation_priority not null,
  source text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.topics enable row level security;
alter table public.prerequisites enable row level security;
alter table public.prerequisite_topics enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.question_prerequisites enable row level security;
alter table public.attempts enable row level security;
alter table public.imported_questions enable row level security;
alter table public.recommendations enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "courses_read_authenticated" on public.courses;
drop policy if exists "topics_read_authenticated" on public.topics;
drop policy if exists "prerequisites_read_authenticated" on public.prerequisites;
drop policy if exists "prerequisite_topics_read_authenticated" on public.prerequisite_topics;
drop policy if exists "questions_read_authenticated" on public.questions;
drop policy if exists "question_options_read_authenticated" on public.question_options;
drop policy if exists "question_prerequisites_read_authenticated" on public.question_prerequisites;
create policy "courses_read_authenticated" on public.courses
  for select to authenticated using (true);
create policy "topics_read_authenticated" on public.topics
  for select to authenticated using (true);
create policy "prerequisites_read_authenticated" on public.prerequisites
  for select to authenticated using (true);
create policy "prerequisite_topics_read_authenticated" on public.prerequisite_topics
  for select to authenticated using (true);
create policy "questions_read_authenticated" on public.questions
  for select to authenticated using (true);
create policy "question_options_read_authenticated" on public.question_options
  for select to authenticated using (true);
create policy "question_prerequisites_read_authenticated" on public.question_prerequisites
  for select to authenticated using (true);

drop policy if exists "attempts_select_own" on public.attempts;
drop policy if exists "attempts_insert_own" on public.attempts;
drop policy if exists "attempts_update_own" on public.attempts;
drop policy if exists "attempts_delete_own" on public.attempts;
create policy "attempts_select_own" on public.attempts
  for select using (auth.uid() = user_id);
create policy "attempts_insert_own" on public.attempts
  for insert with check (auth.uid() = user_id);
create policy "attempts_update_own" on public.attempts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "attempts_delete_own" on public.attempts
  for delete using (auth.uid() = user_id);

drop policy if exists "imported_questions_select_own" on public.imported_questions;
drop policy if exists "imported_questions_insert_own" on public.imported_questions;
drop policy if exists "imported_questions_update_own" on public.imported_questions;
drop policy if exists "imported_questions_delete_own" on public.imported_questions;
create policy "imported_questions_select_own" on public.imported_questions
  for select using (auth.uid() = user_id);
create policy "imported_questions_insert_own" on public.imported_questions
  for insert with check (auth.uid() = user_id);
create policy "imported_questions_update_own" on public.imported_questions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "imported_questions_delete_own" on public.imported_questions
  for delete using (auth.uid() = user_id);

drop policy if exists "recommendations_select_own" on public.recommendations;
drop policy if exists "recommendations_insert_own" on public.recommendations;
drop policy if exists "recommendations_update_own" on public.recommendations;
drop policy if exists "recommendations_delete_own" on public.recommendations;
create policy "recommendations_select_own" on public.recommendations
  for select using (auth.uid() = user_id);
create policy "recommendations_insert_own" on public.recommendations
  for insert with check (auth.uid() = user_id);
create policy "recommendations_update_own" on public.recommendations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "recommendations_delete_own" on public.recommendations
  for delete using (auth.uid() = user_id);
