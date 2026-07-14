drop policy if exists frequent_foods_owner_select on public.frequent_foods;
create policy frequent_foods_owner_select on public.frequent_foods
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
  );

drop policy if exists frequent_foods_owner_insert on public.frequent_foods;
create policy frequent_foods_owner_insert on public.frequent_foods
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
  );

drop policy if exists frequent_foods_owner_update on public.frequent_foods;
create policy frequent_foods_owner_update on public.frequent_foods
  for update to authenticated
  using (
    (select auth.uid()) = user_id
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
  )
  with check (
    (select auth.uid()) = user_id
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
  );

drop policy if exists frequent_foods_owner_delete on public.frequent_foods;
create policy frequent_foods_owner_delete on public.frequent_foods
  for delete to authenticated
  using (
    (select auth.uid()) = user_id
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
  );
