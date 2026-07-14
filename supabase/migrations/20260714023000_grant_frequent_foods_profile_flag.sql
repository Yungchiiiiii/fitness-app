-- The profiles table uses column-level grants. Allow signed-in users to read
-- and update the initialization flag while the existing owner-only RLS
-- policies continue to restrict rows to auth.uid().
grant select (frequent_foods_initialized) on table public.profiles to authenticated;
grant update (frequent_foods_initialized) on table public.profiles to authenticated;
