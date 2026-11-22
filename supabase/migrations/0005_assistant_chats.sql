-- Persistent AI assistant chat history
create table public.assistant_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'New conversation' check (char_length(title) between 1 and 120),
  week integer not null default 1 check (week between 1 and 24),
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assistant_chats_messages_array check (jsonb_typeof(messages) = 'array')
);

create index assistant_chats_user_updated_idx on public.assistant_chats(user_id, updated_at desc);

alter table public.assistant_chats enable row level security;

create policy "approved members manage own assistant chats" on public.assistant_chats for all
  using (user_id = auth.uid() and public.is_approved_member())
  with check (user_id = auth.uid() and public.is_approved_member());

create or replace function public.touch_assistant_chat()
returns trigger language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_assistant_chats_updated_at
  before update on public.assistant_chats
  for each row execute procedure public.touch_assistant_chat();
