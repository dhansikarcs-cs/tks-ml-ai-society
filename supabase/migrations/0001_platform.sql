create extension if not exists pgcrypto;

create type public.member_role as enum ('member', 'admin');
create type public.membership_state as enum ('pending', 'approved', 'denied');
create type public.submission_state as enum ('draft', 'submitted', 'in_review', 'reviewed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '' check (char_length(display_name) <= 80),
  role public.member_role not null default 'member',
  membership_state public.membership_state not null default 'pending',
  weekly_goal_minutes integer not null default 300 check (weekly_goal_minutes between 30 and 3000),
  leaderboard_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and membership_state = 'approved'
  );
$$;

create function public.is_approved_member()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and membership_state = 'approved'
  );
$$;

create function public.protect_profile_privileges()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and new.email is distinct from old.email then
    raise exception 'Account email changes must be handled through Supabase Authentication';
  end if;
  if auth.uid() is not null and not public.is_admin()
     and (new.role is distinct from old.role
       or new.membership_state is distinct from old.membership_state) then
    raise exception 'Role and membership state can only be changed by an administrator';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger protect_profile_privileges_before_update
  before update on public.profiles
  for each row execute procedure public.protect_profile_privileges();

create table public.curriculum_phases (
  id smallint primary key check (id between 1 and 6),
  title text not null check (char_length(title) <= 160),
  subtitle text not null,
  sort_order smallint not null unique
);
insert into public.curriculum_phases (id, title, subtitle, sort_order) values
  (1, 'Mathematical Foundations', 'Build the language and intuition behind machine learning.', 1),
  (2, 'Probability, Statistics & Data', 'Reason about uncertainty and turn raw data into evidence.', 2),
  (3, 'Classical Machine Learning', 'Learn core modeling patterns and when to use them.', 3),
  (4, 'Advanced ML & Deep Learning', 'Understand how neural networks learn and how to train them well.', 4),
  (5, 'Modern AI Architectures', 'Explore vision, language, sequence models, and transformers.', 5),
  (6, 'Applied AI Engineering', 'Turn research ideas into evaluated, responsible applications.', 6);

create table public.curriculum_weeks (
  id smallint primary key check (id between 1 and 24),
  phase_id smallint not null references public.curriculum_phases(id),
  title text not null check (char_length(title) <= 200),
  summary text not null,
  content jsonb not null default '{}'::jsonb,
  published boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  week_id smallint references public.curriculum_weeks(id) on delete set null,
  title text not null,
  url text not null,
  kind text not null check (kind in ('Course','Documentation','Video','Paper','Repository','Reference','PDF')),
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index resources_week_url_unique on public.resources(week_id, url);

create table public.bookmarks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, resource_id)
);

create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_id smallint not null references public.curriculum_weeks(id) on delete cascade,
  item_key text not null,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, week_id, item_key)
);

create table public.learning_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('lesson','reading','coding','research')),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  active_seconds integer not null check (active_seconds between 0 and 43200),
  created_at timestamptz not null default now(),
  check (ended_at >= started_at),
  check (active_seconds <= floor(extract(epoch from (ended_at - started_at))) + 3)
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  week_id smallint not null references public.curriculum_weeks(id) on delete cascade,
  title text not null,
  description text not null,
  due_at timestamptz,
  published boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (week_id, title)
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  repository_url text check (repository_url is null or char_length(repository_url) <= 2048),
  response text not null default '' check (char_length(response) <= 12000),
  status public.submission_state not null default 'draft',
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (assignment_id, user_id)
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) <= 5000),
  is_peer_review boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.peer_review_assignments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (submission_id, reviewer_id)
);
create unique index one_peer_review_per_reviewer on public.feedback(submission_id, reviewer_id) where is_peer_review = true;

create function public.protect_submission_state()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    if tg_op = 'INSERT' then
      if new.status not in ('draft','submitted') then
        raise exception 'Members can only create draft or submitted work';
      end if;
      if new.status = 'submitted' then new.submitted_at = now(); end if;
    end if;
    if tg_op = 'UPDATE' and new.status is distinct from old.status then
      if old.status = 'draft' and new.status = 'submitted' then
        new.submitted_at = now();
      else
        raise exception 'Only an administrator can change a reviewed submission state';
      end if;
    end if;
    if tg_op = 'UPDATE' and new.assignment_id is distinct from old.assignment_id then
      raise exception 'A submission cannot be moved to a different assignment';
    end if;
    if tg_op = 'UPDATE' and new.submitted_at is distinct from old.submitted_at
       and not (old.status = 'draft' and new.status = 'submitted') then
      raise exception 'Submission time is managed by the platform';
    end if;
    if tg_op = 'UPDATE' and old.status in ('in_review','reviewed')
       and (new.response is distinct from old.response or new.repository_url is distinct from old.repository_url) then
      raise exception 'Reviewed work cannot be edited; contact an administrator for a revision';
    end if;
  end if;
  return new;
end;
$$;

create trigger protect_submission_state_before_write
  before insert or update on public.submissions
  for each row execute procedure public.protect_submission_state();

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_id smallint references public.curriculum_weeks(id) on delete set null,
  title text not null check (char_length(title) <= 160),
  description text not null default '' check (char_length(description) <= 4000),
  repository_url text check (repository_url is null or char_length(repository_url) <= 2048),
  status text not null default 'planning' check (status in ('planning','in_progress','submitted')),
  reflection text not null default '' check (char_length(reflection) <= 12000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(title) <= 200),
  completed_at timestamptz,
  sort_order smallint not null default 0,
  unique (project_id, title)
);

create table public.project_feedback (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) <= 5000),
  created_at timestamptz not null default now()
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Untitled note' check (char_length(title) <= 300),
  body text not null default '' check (char_length(body) <= 200000),
  folder text not null default 'General' check (char_length(folder) <= 48),
  tags text[] not null default '{}',
  week_id smallint references public.curriculum_weeks(id) on delete set null,
  pinned boolean not null default false,
  explicitly_shared boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.achievements (
  id text primary key,
  title text not null,
  description text not null,
  icon text not null default 'sparkles'
);

create table public.member_achievements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id text not null references public.achievements(id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create table public.leaderboard_scores (
  user_id uuid not null references public.profiles(id) on delete cascade,
  period_type text not null check (period_type in ('overall','weekly','monthly')),
  period_key text not null,
  assessment_points numeric(8,2) not null default 0 check (assessment_points >= 0),
  project_points numeric(8,2) not null default 0 check (project_points >= 0),
  research_points numeric(8,2) not null default 0 check (research_points >= 0),
  consistency_points numeric(8,2) not null default 0 check (consistency_points >= 0),
  repository_points numeric(8,2) not null default 0 check (repository_points >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, period_type, period_key)
);

create table public.leaderboard_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default true,
  weights jsonb not null default '{"assessment":25,"project":30,"research":20,"consistency":15,"repository":10}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.leaderboard_settings (singleton) values (true) on conflict do nothing;

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  published boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  model text not null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  created_at timestamptz not null default now()
);

create index lesson_progress_user_idx on public.lesson_progress(user_id, week_id);
create index learning_sessions_user_date_idx on public.learning_sessions(user_id, started_at desc);
create index submissions_status_idx on public.submissions(status, submitted_at desc);
create index notes_user_updated_idx on public.notes(user_id, updated_at desc);
create index projects_user_updated_idx on public.projects(user_id, updated_at desc);
create index ai_usage_user_date_idx on public.ai_usage(user_id, created_at desc);
create index announcements_published_idx on public.announcements(published, published_at desc);

alter table public.profiles enable row level security;
alter table public.curriculum_phases enable row level security;
alter table public.curriculum_weeks enable row level security;
alter table public.resources enable row level security;
alter table public.bookmarks enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.learning_sessions enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.feedback enable row level security;
alter table public.peer_review_assignments enable row level security;
alter table public.projects enable row level security;
alter table public.project_milestones enable row level security;
alter table public.project_feedback enable row level security;
alter table public.notes enable row level security;
alter table public.achievements enable row level security;
alter table public.member_achievements enable row level security;
alter table public.leaderboard_scores enable row level security;
alter table public.leaderboard_settings enable row level security;
alter table public.announcements enable row level security;
alter table public.ai_usage enable row level security;

create policy "members read own or admins read profiles" on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy "members update own profile" on public.profiles for update
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
create policy "admins manage profiles" on public.profiles for all
  using (public.is_admin()) with check (public.is_admin());

create policy "approved members read phases" on public.curriculum_phases for select
  using (public.is_approved_member());
create policy "approved members read published weeks" on public.curriculum_weeks for select
  using (public.is_approved_member() and published);
create policy "admins manage curriculum weeks" on public.curriculum_weeks for all
  using (public.is_admin()) with check (public.is_admin());
create policy "admins manage phases" on public.curriculum_phases for all
  using (public.is_admin()) with check (public.is_admin());
create policy "approved members read resources" on public.resources for select
  using (public.is_approved_member());
create policy "admins manage resources" on public.resources for all
  using (public.is_admin()) with check (public.is_admin());

create policy "members manage own bookmarks" on public.bookmarks for all
  using (user_id = auth.uid() and public.is_approved_member())
  with check (user_id = auth.uid() and public.is_approved_member());
create policy "members manage own progress" on public.lesson_progress for all
  using (user_id = auth.uid() and public.is_approved_member())
  with check (user_id = auth.uid() and public.is_approved_member());
create policy "members manage own sessions" on public.learning_sessions for all
  using (user_id = auth.uid() and public.is_approved_member())
  with check (user_id = auth.uid() and public.is_approved_member());

create policy "approved members read published assignments" on public.assignments for select
  using (public.is_approved_member() and published);
create policy "admins manage assignments" on public.assignments for all
  using (public.is_admin()) with check (public.is_admin());
create policy "members read own submissions" on public.submissions for select
  using (user_id = auth.uid() and public.is_approved_member());
create policy "members create own submissions" on public.submissions for insert
  with check (user_id = auth.uid() and public.is_approved_member());
create policy "members update own active submissions" on public.submissions for update
  using (user_id = auth.uid() and public.is_approved_member() and status in ('draft','submitted'))
  with check (user_id = auth.uid() and public.is_approved_member() and status in ('draft','submitted'));
create policy "members delete own drafts" on public.submissions for delete
  using (user_id = auth.uid() and public.is_approved_member() and status = 'draft');
create policy "admins review submissions" on public.submissions for select
  using (public.is_admin());
create policy "admins manage submissions" on public.submissions for all
  using (public.is_admin()) with check (public.is_admin());
create policy "assigned reviewers read assigned submissions" on public.submissions for select
  using (exists (
    select 1 from public.peer_review_assignments a
    where a.submission_id = submissions.id and a.reviewer_id = auth.uid()
  ));
create policy "submission owner and admins read feedback" on public.feedback for select
  using (
    public.is_admin() or exists (
      select 1 from public.submissions s
      where s.id = submission_id and s.user_id = auth.uid()
    ) or (
      is_peer_review and exists (
        select 1 from public.peer_review_assignments a
        where a.submission_id = feedback.submission_id and a.reviewer_id = auth.uid()
      )
    )
  );
create policy "admins and approved peer reviewers create feedback" on public.feedback for insert
  with check (
    reviewer_id = auth.uid()
    and (
      public.is_admin()
      or (
        is_peer_review and public.is_approved_member()
        and exists (
          select 1 from public.peer_review_assignments a
          where a.submission_id = feedback.submission_id and a.reviewer_id = auth.uid()
        )
      )
    )
  );
create policy "admins update feedback" on public.feedback for update
  using (public.is_admin()) with check (public.is_admin());
create policy "assigned member reads peer-review assignment" on public.peer_review_assignments for select
  using (reviewer_id = auth.uid() or public.is_admin());
create policy "admins assign peer reviews" on public.peer_review_assignments for insert
  with check (public.is_admin());
create policy "admins manage peer-review assignments" on public.peer_review_assignments for delete
  using (public.is_admin());

create policy "members manage own projects" on public.projects for all
  using (user_id = auth.uid() and public.is_approved_member())
  with check (user_id = auth.uid() and public.is_approved_member());
create policy "admins read projects" on public.projects for select
  using (public.is_admin());
create policy "admins update project status" on public.projects for update
  using (public.is_admin()) with check (public.is_admin());
create policy "project owners and admins manage milestones" on public.project_milestones for all
  using (public.is_admin() or exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()))
  with check (public.is_admin() or exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));
create policy "owners and admins read project feedback" on public.project_feedback for select
  using (public.is_admin() or exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));
create policy "admins create project feedback" on public.project_feedback for insert
  with check (public.is_admin() and reviewer_id = auth.uid());

create policy "members read own or explicitly shared notes" on public.notes for select
  using (user_id = auth.uid() or (explicitly_shared and public.is_approved_member()));
create policy "members create own notes" on public.notes for insert
  with check (user_id = auth.uid() and public.is_approved_member());
create policy "members update own notes" on public.notes for update
  using (user_id = auth.uid() and public.is_approved_member())
  with check (user_id = auth.uid() and public.is_approved_member());
create policy "members delete own notes" on public.notes for delete
  using (user_id = auth.uid() and public.is_approved_member());

create policy "members read achievements" on public.achievements for select
  using (public.is_approved_member());
create policy "admins manage achievements" on public.achievements for all
  using (public.is_admin()) with check (public.is_admin());
create policy "members read own earned achievements" on public.member_achievements for select
  using (user_id = auth.uid() or public.is_admin());
create policy "admins manage earned achievements" on public.member_achievements for all
  using (public.is_admin()) with check (public.is_admin());

create policy "members read own leaderboard scores" on public.leaderboard_scores for select
  using (user_id = auth.uid() or public.is_admin());
create policy "admins manage leaderboard scores" on public.leaderboard_scores for all
  using (public.is_admin()) with check (public.is_admin());
create policy "members read leaderboard configuration" on public.leaderboard_settings for select
  using (public.is_approved_member());
create policy "admins manage leaderboard configuration" on public.leaderboard_settings for all
  using (public.is_admin()) with check (public.is_admin());

create view public.society_leaderboard with (security_invoker = false) as
select
  s.user_id,
  p.display_name,
  s.period_type,
  s.period_key,
  round(
    s.assessment_points * ((settings.weights ->> 'assessment')::numeric / 100)
    + s.project_points * ((settings.weights ->> 'project')::numeric / 100)
    + s.research_points * ((settings.weights ->> 'research')::numeric / 100)
    + s.consistency_points * ((settings.weights ->> 'consistency')::numeric / 100)
    + s.repository_points * ((settings.weights ->> 'repository')::numeric / 100),
    2
  ) as total_points
from public.leaderboard_scores s
join public.profiles p on p.id = s.user_id
cross join public.leaderboard_settings settings
where settings.singleton = true
  and settings.enabled = true
  and p.membership_state = 'approved'
  and p.leaderboard_visible = true
  and public.is_approved_member();
grant select on public.society_leaderboard to authenticated;

create view public.society_analytics with (security_invoker = false) as
select
  (select count(*) from public.profiles where membership_state = 'approved')::bigint as approved_members,
  (select count(distinct user_id) from public.learning_sessions where started_at >= now() - interval '7 days')::bigint as active_members_7d,
  (select coalesce(sum(active_seconds), 0) from public.learning_sessions where started_at >= now() - interval '7 days')::bigint as active_seconds_7d,
  (select count(*) from public.submissions where status in ('submitted','in_review'))::bigint as pending_reviews,
  (select count(*) from public.assignments where published = true)::bigint as published_assignments
where public.is_admin();
grant select on public.society_analytics to authenticated;

create policy "members read published announcements" on public.announcements for select
  using (public.is_approved_member() and published);
create policy "admins manage announcements" on public.announcements for all
  using (public.is_admin()) with check (public.is_admin());
create policy "members read own AI usage" on public.ai_usage for select
  using (user_id = auth.uid() or public.is_admin());
create policy "approved members create own AI usage" on public.ai_usage for insert
  with check (user_id = auth.uid() and public.is_approved_member());

insert into public.achievements (id, title, description, icon) values
  ('first-lesson', 'First steps', 'Complete your first curriculum lesson.', 'book-open'),
  ('week-complete', 'Week in the books', 'Complete every checklist item in a curriculum week.', 'check-circle'),
  ('first-project', 'Builder', 'Submit your first practical project.', 'flask-conical'),
  ('research-reader', 'Curious reader', 'Review a research paper and capture your notes.', 'file-text'),
  ('consistent-learner', 'Steady practice', 'Log learning sessions on five different days.', 'flame'),
  ('capstone', 'Capstone complete', 'Submit all capstone milestones for review.', 'sparkles')
on conflict (id) do nothing;
