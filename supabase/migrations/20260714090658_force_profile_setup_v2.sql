-- Force every existing account through the version 2 profile setup once.
-- Existing profile values are preserved and prefilled for review.
alter table public.profiles
  add column if not exists profile_setup_version integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_profile_setup_version_check'
  ) then
    alter table public.profiles
      add constraint profiles_profile_setup_version_check
      check (profile_setup_version >= 0);
  end if;
end
$$;

grant select (profile_setup_version) on table public.profiles to authenticated;
grant insert (profile_setup_version) on table public.profiles to authenticated;
grant update (profile_setup_version) on table public.profiles to authenticated;
