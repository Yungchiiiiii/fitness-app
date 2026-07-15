-- Replace the project's older public-role policies with authenticated owner policies.
-- This is intentionally separate so an existing Supabase project can be upgraded safely.

create extension if not exists pgcrypto;

alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists height_cm numeric(5, 1);
alter table public.profiles add column if not exists weight_kg numeric(5, 1);
alter table public.profiles add column if not exists targets text[] not null default '{}'::text[];
alter table public.profiles add column if not exists training_days integer not null default 5;
alter table public.profiles add column if not exists calories_target integer;
alter table public.profiles add column if not exists carbs_target integer;
alter table public.profiles add column if not exists fat_target integer;

alter table public.workout_sessions add column if not exists note text;
alter table public.session_exercises add column if not exists pain_intensity integer;
alter table public.session_exercises add column if not exists updated_at timestamptz not null default now();

alter table public.food_logs add column if not exists meal text not null default '點心';
alter table public.food_logs add column if not exists kcal numeric(8, 1) not null default 0;
alter table public.food_logs add column if not exists note text;
alter table public.food_logs add column if not exists source text not null default 'manual';
alter table public.food_logs add column if not exists updated_at timestamptz not null default now();
update public.food_logs set kcal = calories where coalesce(kcal, 0) = 0 and calories is not null;
update public.food_logs set meal = meal_time where meal_time is not null and meal_time <> '';
alter table public.food_logs drop constraint if exists food_logs_source_check;
alter table public.food_logs add constraint food_logs_source_check check (source in ('manual', 'quick', 'ai'));

alter table public.custom_exercises add column if not exists input_type text;
alter table public.custom_exercises add column if not exists updated_at timestamptz not null default now();

create table if not exists public.body_weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  weight numeric(5, 1) not null check (weight > 0 and weight < 500),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists public.recovery_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  body_part text not null,
  intensity integer not null check (intensity between 0 and 10),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('food-analysis', 'coach-chat')),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.session_exercises enable row level security;
alter table public.exercise_sets enable row level security;
alter table public.food_logs enable row level security;
alter table public.custom_exercises enable row level security;
alter table public.body_weight_logs enable row level security;
alter table public.recovery_logs enable row level security;
alter table public.ai_events enable row level security;

create index if not exists custom_exercises_user_idx on public.custom_exercises (user_id);
create index if not exists workout_sessions_user_date_idx on public.workout_sessions (user_id, date desc);
create index if not exists session_exercises_session_idx on public.session_exercises (session_id, order_index);
create index if not exists exercise_sets_exercise_idx on public.exercise_sets (exercise_id, order_index);
create index if not exists food_logs_user_date_idx on public.food_logs (user_id, date desc, logged_at);
create index if not exists body_weight_logs_user_date_idx on public.body_weight_logs (user_id, date desc);
create index if not exists recovery_logs_user_date_idx on public.recovery_logs (user_id, date desc);
create index if not exists ai_events_user_created_idx on public.ai_events (user_id, created_at desc);

drop policy if exists "own profile select" on public.profiles;
drop policy if exists "own profile insert" on public.profiles;
drop policy if exists "own profile update" on public.profiles;
drop policy if exists "own profile delete" on public.profiles;
drop policy if exists profiles_owner_select on public.profiles;
drop policy if exists profiles_owner_insert on public.profiles;
drop policy if exists profiles_owner_update on public.profiles;
drop policy if exists profiles_owner_delete on public.profiles;
create policy profiles_owner_select on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_owner_insert on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy profiles_owner_update on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy profiles_owner_delete on public.profiles for delete to authenticated using ((select auth.uid()) = id);

drop policy if exists "own sessions select" on public.workout_sessions;
drop policy if exists "own sessions insert" on public.workout_sessions;
drop policy if exists "own sessions update" on public.workout_sessions;
drop policy if exists "own sessions delete" on public.workout_sessions;
drop policy if exists workout_sessions_owner_select on public.workout_sessions;
drop policy if exists workout_sessions_owner_insert on public.workout_sessions;
drop policy if exists workout_sessions_owner_update on public.workout_sessions;
drop policy if exists workout_sessions_owner_delete on public.workout_sessions;
create policy workout_sessions_owner_select on public.workout_sessions for select to authenticated using ((select auth.uid()) = user_id);
create policy workout_sessions_owner_insert on public.workout_sessions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy workout_sessions_owner_update on public.workout_sessions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy workout_sessions_owner_delete on public.workout_sessions for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "own exercises select" on public.session_exercises;
drop policy if exists "own exercises insert" on public.session_exercises;
drop policy if exists "own exercises update" on public.session_exercises;
drop policy if exists "own exercises delete" on public.session_exercises;
drop policy if exists session_exercises_owner_select on public.session_exercises;
drop policy if exists session_exercises_owner_insert on public.session_exercises;
drop policy if exists session_exercises_owner_update on public.session_exercises;
drop policy if exists session_exercises_owner_delete on public.session_exercises;
create policy session_exercises_owner_select on public.session_exercises for select to authenticated using (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())));
create policy session_exercises_owner_insert on public.session_exercises for insert to authenticated with check (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())));
create policy session_exercises_owner_update on public.session_exercises for update to authenticated using (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid()))) with check (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())));
create policy session_exercises_owner_delete on public.session_exercises for delete to authenticated using (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())));

drop policy if exists "own sets select" on public.exercise_sets;
drop policy if exists "own sets insert" on public.exercise_sets;
drop policy if exists "own sets update" on public.exercise_sets;
drop policy if exists "own sets delete" on public.exercise_sets;
drop policy if exists exercise_sets_owner_select on public.exercise_sets;
drop policy if exists exercise_sets_owner_insert on public.exercise_sets;
drop policy if exists exercise_sets_owner_update on public.exercise_sets;
drop policy if exists exercise_sets_owner_delete on public.exercise_sets;
create policy exercise_sets_owner_select on public.exercise_sets for select to authenticated using (exists (select 1 from public.session_exercises e join public.workout_sessions s on s.id = e.session_id where e.id = exercise_id and s.user_id = (select auth.uid())));
create policy exercise_sets_owner_insert on public.exercise_sets for insert to authenticated with check (exists (select 1 from public.session_exercises e join public.workout_sessions s on s.id = e.session_id where e.id = exercise_id and s.user_id = (select auth.uid())));
create policy exercise_sets_owner_update on public.exercise_sets for update to authenticated using (exists (select 1 from public.session_exercises e join public.workout_sessions s on s.id = e.session_id where e.id = exercise_id and s.user_id = (select auth.uid()))) with check (exists (select 1 from public.session_exercises e join public.workout_sessions s on s.id = e.session_id where e.id = exercise_id and s.user_id = (select auth.uid())));
create policy exercise_sets_owner_delete on public.exercise_sets for delete to authenticated using (exists (select 1 from public.session_exercises e join public.workout_sessions s on s.id = e.session_id where e.id = exercise_id and s.user_id = (select auth.uid())));

drop policy if exists "own food select" on public.food_logs;
drop policy if exists "own food insert" on public.food_logs;
drop policy if exists "own food update" on public.food_logs;
drop policy if exists "own food delete" on public.food_logs;
drop policy if exists food_logs_owner_select on public.food_logs;
drop policy if exists food_logs_owner_insert on public.food_logs;
drop policy if exists food_logs_owner_update on public.food_logs;
drop policy if exists food_logs_owner_delete on public.food_logs;
create policy food_logs_owner_select on public.food_logs for select to authenticated using ((select auth.uid()) = user_id);
create policy food_logs_owner_insert on public.food_logs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy food_logs_owner_update on public.food_logs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy food_logs_owner_delete on public.food_logs for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "own custom ex select" on public.custom_exercises;
drop policy if exists "own custom ex insert" on public.custom_exercises;
drop policy if exists "own custom ex update" on public.custom_exercises;
drop policy if exists "own custom ex delete" on public.custom_exercises;
drop policy if exists custom_exercises_owner_select on public.custom_exercises;
drop policy if exists custom_exercises_owner_insert on public.custom_exercises;
drop policy if exists custom_exercises_owner_update on public.custom_exercises;
drop policy if exists custom_exercises_owner_delete on public.custom_exercises;
create policy custom_exercises_owner_select on public.custom_exercises for select to authenticated using ((select auth.uid()) = user_id);
create policy custom_exercises_owner_insert on public.custom_exercises for insert to authenticated with check ((select auth.uid()) = user_id);
create policy custom_exercises_owner_update on public.custom_exercises for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy custom_exercises_owner_delete on public.custom_exercises for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists body_weight_logs_owner_select on public.body_weight_logs;
drop policy if exists body_weight_logs_owner_insert on public.body_weight_logs;
drop policy if exists body_weight_logs_owner_update on public.body_weight_logs;
drop policy if exists body_weight_logs_owner_delete on public.body_weight_logs;
create policy body_weight_logs_owner_select on public.body_weight_logs for select to authenticated using ((select auth.uid()) = user_id);
create policy body_weight_logs_owner_insert on public.body_weight_logs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy body_weight_logs_owner_update on public.body_weight_logs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy body_weight_logs_owner_delete on public.body_weight_logs for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists recovery_logs_owner_select on public.recovery_logs;
drop policy if exists recovery_logs_owner_insert on public.recovery_logs;
drop policy if exists recovery_logs_owner_update on public.recovery_logs;
drop policy if exists recovery_logs_owner_delete on public.recovery_logs;
create policy recovery_logs_owner_select on public.recovery_logs for select to authenticated using ((select auth.uid()) = user_id);
create policy recovery_logs_owner_insert on public.recovery_logs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy recovery_logs_owner_update on public.recovery_logs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy recovery_logs_owner_delete on public.recovery_logs for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists ai_events_owner_select on public.ai_events;
drop policy if exists ai_events_owner_insert on public.ai_events;
create policy ai_events_owner_select on public.ai_events for select to authenticated using ((select auth.uid()) = user_id);
create policy ai_events_owner_insert on public.ai_events for insert to authenticated with check ((select auth.uid()) = user_id);

revoke all on public.profiles, public.workout_sessions, public.session_exercises, public.exercise_sets,
  public.food_logs, public.custom_exercises, public.body_weight_logs, public.recovery_logs, public.ai_events from anon;
grant select, insert, update, delete on public.profiles, public.workout_sessions, public.session_exercises,
  public.exercise_sets, public.food_logs, public.custom_exercises, public.body_weight_logs, public.recovery_logs to authenticated;
grant select, insert on public.ai_events to authenticated;

do $$
begin
  if to_regprocedure('public.handle_new_user()') is not null then
    execute 'revoke execute on function public.handle_new_user() from public, anon, authenticated';
    execute 'alter function public.handle_new_user() set search_path = public, pg_temp';
  end if;
  if to_regprocedure('public.update_updated_at()') is not null then
    execute 'alter function public.update_updated_at() set search_path = public, pg_temp';
  end if;
end
$$;

create or replace view public.v_daily_nutrition
with (security_invoker = true)
as
select
  user_id,
  date,
  round(sum(kcal), 1) as calories,
  round(sum(protein), 1) as protein,
  round(sum(carbs), 1) as carbs,
  round(sum(fat), 1) as fat,
  count(*)::integer as meal_count
from public.food_logs
group by user_id, date;

create or replace view public.v_exercise_progress
with (security_invoker = true)
as
select
  s.user_id,
  e.name as exercise_name,
  s.date,
  max(es.weight) as best_weight,
  max(case when es.weight is not null and es.reps between 1 and 36
    then round(es.weight * (36.0 / (37.0 - least(es.reps, 36))), 1)
    else null end) as best_estimated_1rm,
  count(es.id)::integer as total_sets,
  coalesce(sum(es.reps), 0)::integer as total_reps,
  coalesce(round(sum(coalesce(es.weight, 0) * coalesce(es.reps, 0)), 1), 0) as total_volume,
  coalesce(sum(es.duration_seconds), 0)::integer as total_duration_seconds
from public.workout_sessions s
join public.session_exercises e on e.session_id = s.id
left join public.exercise_sets es on es.exercise_id = e.id
group by s.user_id, e.name, s.date;

create or replace view public.v_weekly_training_summary
with (security_invoker = true)
as
select
  s.user_id,
  date_trunc('week', s.date)::date as week_start,
  count(distinct s.id)::integer as sessions_count,
  count(distinct e.id)::integer as exercise_count,
  count(es.id)::integer as set_count,
  coalesce(round(sum(coalesce(es.weight, 0) * coalesce(es.reps, 0)), 1), 0) as total_volume
from public.workout_sessions s
left join public.session_exercises e on e.session_id = s.id
left join public.exercise_sets es on es.exercise_id = e.id
group by s.user_id, date_trunc('week', s.date)::date;

grant select on public.v_daily_nutrition, public.v_exercise_progress, public.v_weekly_training_summary to authenticated;
;
