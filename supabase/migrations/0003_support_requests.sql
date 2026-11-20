-- Member support requests / help center (bugs, complaints, help)
create type public.support_status as enum ('open', 'in_progress', 'resolved');

create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('help', 'bug', 'complaint', 'feedback', 'other')),
  subject text not null check (char_length(subject) between 3 and 160),
  message text not null check (char_length(message) between 10 and 5000),
  status public.support_status not null default 'open',
  admin_note text check (admin_note is null or char_length(admin_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index support_requests_user_idx on public.support_requests(user_id, created_at desc);
create index support_requests_status_idx on public.support_requests(status, created_at desc);

alter table public.support_requests enable row level security;

create policy "approved members create own support requests" on public.support_requests for insert
  with check (user_id = auth.uid() and public.is_approved_member());
create policy "members read own support requests" on public.support_requests for select
  using (user_id = auth.uid() or public.is_admin());
create policy "admins manage support requests" on public.support_requests for all
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.touch_support_request()
returns trigger language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_support_requests_updated_at
  before update on public.support_requests
  for each row execute procedure public.touch_support_request();
