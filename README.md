# TKS ML & AI Society

An internal, responsive learning workspace for the TKS Machine Learning & AI Society.

## Run locally

```powershell
npm install
npm run dev
```

The application works without credentials in **local workspace mode**. Curriculum progress, project plans, focus sessions, saved resources, and notebook notes are stored in this browser. They are not accounts, they do not cross devices, and browser storage can be cleared. Notebook content uses IndexedDB; use Markdown export for a portable backup.

## Enable Supabase authentication and cloud data

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Apply `supabase/migrations/0001_platform.sql` in the Supabase SQL editor (or use the Supabase CLI).
4. Restart the Next.js development server.
5. Register through `/login`. New profiles begin as `pending`; an administrator must approve them.
6. Create the first administrator manually from the Supabase SQL editor after confirming their account:

   ```sql
   update public.profiles
   set role = 'admin', membership_state = 'approved'
   where email = 'your-admin-email@example.com';
   ```

7. For production, configure the same public Supabase URL/key in Vercel. The service-role key must never be added to the browser or a `NEXT_PUBLIC_` variable.

### Seed the complete curriculum

The application includes all 24 weeks as checked-in seed content. To publish all phases, detailed learning content, resources, and weekly assignments to Supabase, run the one-time seed script from a trusted developer machine. It requires the Supabase service-role key in the process environment; do not commit it.

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = "https://YOUR_PROJECT.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "YOUR_SERVICE_ROLE_KEY"
npm run seed:curriculum
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
```

## Optional AI assistant

The assistant is disabled unless all required services are configured. Set the following **server-only** environment variables in `.env.local` for development and Vercel for deployment:

- `AI_API_URL` — trusted HTTPS OpenAI-compatible chat-completions endpoint.
- `AI_API_KEY` — private provider key.
- `AI_MODEL` — provider model identifier.

AI requests require an approved Supabase member session. The server route validates request size and messages, attaches the current curriculum context, applies a per-user request throttle and daily quota, and never sends provider credentials to the browser. The daily quota is stored in `ai_usage`; the short-window throttle is process-local and should be replaced with a shared limiter for multi-instance/high-traffic deployments.

## What works without cloud credentials

- Complete 24-week curriculum, checklists, saved practice answers, and progress indicators.
- Resource search, filters, and bookmarks.
- Private, local-first technical notebook with Markdown, LaTeX, autosave, and export.
- Project plans, milestones, capstone checklist, and local assignment drafts.
- Explicit focus sessions that count only while the page is visible and active.
- Personal achievements based on local completion/submission data.

## Cloud-backed workflows

When Supabase is configured, the schema enforces roles and ownership with RLS. Approved members can sync curriculum progress, projects, and learning sessions, save assignment submissions, sync notebook notes with conflict choices, and participate in assigned peer reviews. Administrators can approve members, manage assignments/resources/announcements/curriculum summaries, review projects and submissions, send private feedback, assign peer reviews, see aggregate-only analytics, and configure leaderboard weights.

The local workspace is not a mock account. Administrator tools and AI stay unavailable until a real authenticated, approved role and required provider configuration are present.
