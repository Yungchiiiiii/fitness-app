create table if not exists public.hidden_exercises (
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_name text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, exercise_name)
);

alter table public.hidden_exercises enable row level security;

revoke all on public.hidden_exercises from anon;
grant select, insert, delete on public.hidden_exercises to authenticated;

drop policy if exists hidden_exercises_owner_select on public.hidden_exercises;
create policy hidden_exercises_owner_select on public.hidden_exercises
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists hidden_exercises_owner_insert on public.hidden_exercises;
create policy hidden_exercises_owner_insert on public.hidden_exercises
for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists hidden_exercises_owner_delete on public.hidden_exercises;
create policy hidden_exercises_owner_delete on public.hidden_exercises
for delete to authenticated using ((select auth.uid()) = user_id);
