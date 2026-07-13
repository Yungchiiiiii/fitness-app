-- Fitness app backend foundation.
-- Every user-owned row is protected by RLS and linked to auth.users.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  height_cm numeric(5, 1),
  weight_kg numeric(5, 1),
  targets text[] not null default '{}'::text[],
  training_days integer not null default 5 check (training_days between 1 and 7),
  calories_target integer,
  protein_target integer,
  carbs_target integer,
  fat_target integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  name text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  name text not null,
  category text,
  order_index integer not null default 0,
  note text,
  pain_intensity integer check (pain_intensity between 0 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exercise_sets (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.session_exercises(id) on delete cascade,
  order_index integer not null default 0,
  weight numeric(8, 2),
  reps integer,
  duration_seconds integer,
  unit text not null default 'kg',
  created_at timestamptz not null default now()
);

create table if not exists public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  meal text not null default '點心',
  name text not null,
  kcal numeric(8, 1) not null default 0,
  protein numeric(8, 1) not null default 0,
  carbs numeric(8, 1) not null default 0,
  fat numeric(8, 1) not null default 0,
  note text,
  source text not null default 'manual' check (source in ('manual', 'quick', 'ai')),
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.custom_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text,
  input_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

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

create index if not exists workout_sessions_user_date_idx on public.workout_sessions (user_id, date desc);
create index if not exists session_exercises_session_idx on public.session_exercises (session_id, order_index);
create index if not exists exercise_sets_exercise_idx on public.exercise_sets (exercise_id, order_index);
create index if not exists food_logs_user_date_idx on public.food_logs (user_id, date desc, logged_at);
create index if not exists custom_exercises_user_idx on public.custom_exercises (user_id);
create index if not exists body_weight_logs_user_date_idx on public.body_weight_logs (user_id, date desc);
create index if not exists recovery_logs_user_date_idx on public.recovery_logs (user_id, date desc);
create index if not exists ai_events_user_created_idx on public.ai_events (user_id, created_at desc);

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists workout_sessions_updated_at on public.workout_sessions;
create trigger workout_sessions_updated_at before update on public.workout_sessions
for each row execute function public.set_updated_at();

drop trigger if exists session_exercises_updated_at on public.session_exercises;
create trigger session_exercises_updated_at before update on public.session_exercises
for each row execute function public.set_updated_at();

drop trigger if exists food_logs_updated_at on public.food_logs;
create trigger food_logs_updated_at before update on public.food_logs
for each row execute function public.set_updated_at();

drop trigger if exists custom_exercises_updated_at on public.custom_exercises;
create trigger custom_exercises_updated_at before update on public.custom_exercises
for each row execute function public.set_updated_at();

drop trigger if exists body_weight_logs_updated_at on public.body_weight_logs;
create trigger body_weight_logs_updated_at before update on public.body_weight_logs
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.session_exercises enable row level security;
alter table public.exercise_sets enable row level security;
alter table public.food_logs enable row level security;
alter table public.custom_exercises enable row level security;
alter table public.body_weight_logs enable row level security;
alter table public.recovery_logs enable row level security;
alter table public.ai_events enable row level security;

revoke all on public.profiles from anon;
revoke all on public.workout_sessions from anon;
revoke all on public.session_exercises from anon;
revoke all on public.exercise_sets from anon;
revoke all on public.food_logs from anon;
revoke all on public.custom_exercises from anon;
revoke all on public.body_weight_logs from anon;
revoke all on public.recovery_logs from anon;
revoke all on public.ai_events from anon;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.workout_sessions to authenticated;
grant select, insert, update, delete on public.session_exercises to authenticated;
grant select, insert, update, delete on public.exercise_sets to authenticated;
grant select, insert, update, delete on public.food_logs to authenticated;
grant select, insert, update, delete on public.custom_exercises to authenticated;
grant select, insert, update, delete on public.body_weight_logs to authenticated;
grant select, insert, update, delete on public.recovery_logs to authenticated;
grant select, insert on public.ai_events to authenticated;

drop policy if exists profiles_owner_select on public.profiles;
create policy profiles_owner_select on public.profiles for select to authenticated
using ((select auth.uid()) = id);
drop policy if exists profiles_owner_insert on public.profiles;
create policy profiles_owner_insert on public.profiles for insert to authenticated
with check ((select auth.uid()) = id);
drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update on public.profiles for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
drop policy if exists profiles_owner_delete on public.profiles;
create policy profiles_owner_delete on public.profiles for delete to authenticated
using ((select auth.uid()) = id);

drop policy if exists workout_sessions_owner_select on public.workout_sessions;
create policy workout_sessions_owner_select on public.workout_sessions for select to authenticated
using ((select auth.uid()) = user_id);
drop policy if exists workout_sessions_owner_insert on public.workout_sessions;
create policy workout_sessions_owner_insert on public.workout_sessions for insert to authenticated
with check ((select auth.uid()) = user_id);
drop policy if exists workout_sessions_owner_update on public.workout_sessions;
create policy workout_sessions_owner_update on public.workout_sessions for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists workout_sessions_owner_delete on public.workout_sessions;
create policy workout_sessions_owner_delete on public.workout_sessions for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists session_exercises_owner_select on public.session_exercises;
create policy session_exercises_owner_select on public.session_exercises for select to authenticated
using (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())));
drop policy if exists session_exercises_owner_insert on public.session_exercises;
create policy session_exercises_owner_insert on public.session_exercises for insert to authenticated
with check (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())));
drop policy if exists session_exercises_owner_update on public.session_exercises;
create policy session_exercises_owner_update on public.session_exercises for update to authenticated
using (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())))
with check (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())));
drop policy if exists session_exercises_owner_delete on public.session_exercises;
create policy session_exercises_owner_delete on public.session_exercises for delete to authenticated
using (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())));

drop policy if exists exercise_sets_owner_select on public.exercise_sets;
create policy exercise_sets_owner_select on public.exercise_sets for select to authenticated
using (exists (
  select 1 from public.session_exercises e
  join public.workout_sessions s on s.id = e.session_id
  where e.id = exercise_id and s.user_id = (select auth.uid())
));
drop policy if exists exercise_sets_owner_insert on public.exercise_sets;
create policy exercise_sets_owner_insert on public.exercise_sets for insert to authenticated
with check (exists (
  select 1 from public.session_exercises e
  join public.workout_sessions s on s.id = e.session_id
  where e.id = exercise_id and s.user_id = (select auth.uid())
));
drop policy if exists exercise_sets_owner_update on public.exercise_sets;
create policy exercise_sets_owner_update on public.exercise_sets for update to authenticated
using (exists (
  select 1 from public.session_exercises e
  join public.workout_sessions s on s.id = e.session_id
  where e.id = exercise_id and s.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.session_exercises e
  join public.workout_sessions s on s.id = e.session_id
  where e.id = exercise_id and s.user_id = (select auth.uid())
));
drop policy if exists exercise_sets_owner_delete on public.exercise_sets;
create policy exercise_sets_owner_delete on public.exercise_sets for delete to authenticated
using (exists (
  select 1 from public.session_exercises e
  join public.workout_sessions s on s.id = e.session_id
  where e.id = exercise_id and s.user_id = (select auth.uid())
));

-- Directly owned tables share the same row ownership rule.
drop policy if exists food_logs_owner_select on public.food_logs;
create policy food_logs_owner_select on public.food_logs for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists food_logs_owner_insert on public.food_logs;
create policy food_logs_owner_insert on public.food_logs for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists food_logs_owner_update on public.food_logs;
create policy food_logs_owner_update on public.food_logs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists food_logs_owner_delete on public.food_logs;
create policy food_logs_owner_delete on public.food_logs for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists custom_exercises_owner_select on public.custom_exercises;
create policy custom_exercises_owner_select on public.custom_exercises for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists custom_exercises_owner_insert on public.custom_exercises;
create policy custom_exercises_owner_insert on public.custom_exercises for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists custom_exercises_owner_update on public.custom_exercises;
create policy custom_exercises_owner_update on public.custom_exercises for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists custom_exercises_owner_delete on public.custom_exercises;
create policy custom_exercises_owner_delete on public.custom_exercises for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists body_weight_logs_owner_select on public.body_weight_logs;
create policy body_weight_logs_owner_select on public.body_weight_logs for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists body_weight_logs_owner_insert on public.body_weight_logs;
create policy body_weight_logs_owner_insert on public.body_weight_logs for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists body_weight_logs_owner_update on public.body_weight_logs;
create policy body_weight_logs_owner_update on public.body_weight_logs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists body_weight_logs_owner_delete on public.body_weight_logs;
create policy body_weight_logs_owner_delete on public.body_weight_logs for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists recovery_logs_owner_select on public.recovery_logs;
create policy recovery_logs_owner_select on public.recovery_logs for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists recovery_logs_owner_insert on public.recovery_logs;
create policy recovery_logs_owner_insert on public.recovery_logs for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists recovery_logs_owner_update on public.recovery_logs;
create policy recovery_logs_owner_update on public.recovery_logs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists recovery_logs_owner_delete on public.recovery_logs;
create policy recovery_logs_owner_delete on public.recovery_logs for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists ai_events_owner_select on public.ai_events;
create policy ai_events_owner_select on public.ai_events for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists ai_events_owner_insert on public.ai_events;
create policy ai_events_owner_insert on public.ai_events for insert to authenticated with check ((select auth.uid()) = user_id);

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

grant select on public.v_daily_nutrition to authenticated;
grant select on public.v_exercise_progress to authenticated;
grant select on public.v_weekly_training_summary to authenticated;
