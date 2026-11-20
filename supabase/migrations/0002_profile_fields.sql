-- Add profile fields for username and affiliation
alter table public.profiles
  add column if not exists username text check (username is null or char_length(username) between 3 and 32),
  add column if not exists affiliation text not null default 'tks' check (affiliation in ('tks', 'other')),
  add column if not exists organization_name text check (organization_name is null or char_length(organization_name) <= 120);

create unique index if not exists profiles_username_unique on public.profiles (lower(username)) where username is not null and username <> '';

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  uname text;
begin
  uname := nullif(lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', ''), '[^a-zA-Z0-9_.-]', '', 'g')), '');
  insert into public.profiles (id, email, display_name, username, affiliation, organization_name)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(new.email, '@', 1)
    ),
    case when uname is not null and char_length(uname) >= 3 then left(uname, 32) else null end,
    case when new.raw_user_meta_data ->> 'affiliation' = 'other' then 'other' else 'tks' end,
    nullif(trim(new.raw_user_meta_data ->> 'organization_name'), '')
  );
  return new;
end;
$$;
