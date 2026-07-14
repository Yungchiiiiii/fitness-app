create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;

alter table public.profiles
  add column if not exists frequent_foods_initialized boolean not null default false;

create table if not exists public.frequent_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal text not null check (meal in ('早餐', '午餐', '晚餐', '點心')),
  name text not null,
  kcal numeric(8, 1) not null default 0 check (kcal >= 0),
  protein numeric(8, 1) not null default 0 check (protein >= 0),
  carbs numeric(8, 1) not null default 0 check (carbs >= 0),
  fat numeric(8, 1) not null default 0 check (fat >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, meal, name)
);

alter table public.frequent_foods enable row level security;

create index if not exists frequent_foods_user_meal_idx
  on public.frequent_foods (user_id, meal, sort_order, created_at);

drop policy if exists frequent_foods_owner_select on public.frequent_foods;
create policy frequent_foods_owner_select on public.frequent_foods
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists frequent_foods_owner_insert on public.frequent_foods;
create policy frequent_foods_owner_insert on public.frequent_foods
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists frequent_foods_owner_update on public.frequent_foods;
create policy frequent_foods_owner_update on public.frequent_foods
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists frequent_foods_owner_delete on public.frequent_foods;
create policy frequent_foods_owner_delete on public.frequent_foods
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.frequent_foods to authenticated;
revoke all on public.frequent_foods from anon;

drop trigger if exists frequent_foods_set_updated_at on public.frequent_foods;
create trigger frequent_foods_set_updated_at
before update on public.frequent_foods
for each row execute function public.set_updated_at();
