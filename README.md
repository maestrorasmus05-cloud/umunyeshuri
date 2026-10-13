# NEXUS EDU

AI-powered digital learning platform: courses, quizzes, assignments, grades, XP and achievements,
an AI Coach, and role-based dashboards for students, teachers and parents.

**Stack:** React + Vite (static web app / PWA-ready) · Supabase (Auth, Postgres, Row Level Security, Edge Functions)

## What's included (Phase 1 + parts of 2 and 3 from the roadmap)

| Role | Features |
|---|---|
| Student | Dashboard, enroll in courses, lessons with video, quizzes (server-graded), assignments, grades, schedule, XP / levels / streaks / achievements, AI Coach |
| Teacher | Create courses, modules, lessons, quizzes, assignments, sessions; publish; grade submissions; class progress and students needing help |
| Parent | Link a child with a code; see progress, quiz average and recent grades |
| Admin | Same as teacher, plus read access to all data (set role in the SQL editor) |

## 1. Set up Supabase

1. Create a project at <https://supabase.com>.
2. Open **SQL Editor** and run these files **in order**:
   1. `supabase/migrations/20260101000000_schema.sql`
   2. `supabase/migrations/20260101000100_functions.sql`
   3. `supabase/migrations/20260101000200_rls.sql`
3. **Authentication → Providers → Email**: for quick testing, turn off "Confirm email" (turn it back on for production).
4. Copy **Project URL** and **anon public key** from **Project Settings → API**.

> Prefer the CLI? `supabase link --project-ref <ref>` then `supabase db push`.

## 2. Run the app locally

```bash
cp .env.example .env      # paste your URL and anon key
npm install
npm run dev
```

Sign up a **teacher** account, create a course, then sign up a **student** account in another browser/profile to join it.
Want instant demo content? After creating a teacher account, run `supabase/seed.sql` in the SQL editor.

## 3. Turn on the AI Coach

```bash
supabase functions deploy ai-coach
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
# optional: supabase secrets set AI_MODEL=claude-sonnet-5-5
```

The key stays on the server; the browser never sees it. The function limits each user to 60 messages per hour.

## 4. Put it on GitHub

```bash
git init && git add . && git commit -m "NEXUS EDU"
git branch -M main
git remote add origin https://github.com/<you>/nexus-edu.git
git push -u origin main
```

Then, to publish the site on GitHub Pages:

1. **Settings → Pages → Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions**: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Push to `main`. The *Deploy to GitHub Pages* workflow builds and publishes it.

(Optional) For one-click database/function deploys add `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`, `SUPABASE_DB_PASSWORD`
and run the *Deploy Supabase* workflow manually.

Other hosts (Vercel, Netlify, Cloudflare Pages) also work: build command `npm run build`, output `dist`, same two env vars.

## Security model

- The browser only ever uses the **anon key**. Never put the `service_role` key in the app or in Git.
- Every table has Row Level Security. Students see only their own data; teachers only their own courses and enrolled students; parents only linked children.
- **Quiz answers** are in a separate table students cannot read. Quizzes are graded in the database (`submit_quiz`).
- **XP, levels, streaks, progress and grades** can't be edited from the client; they change only through server functions (`complete_lesson`, `submit_quiz`, `grade_submission`). XP for quizzes is awarded once per quiz to prevent farming.
- Roles: self-signup can choose student, teacher or parent, never admin. To restrict teacher signup (recommended for real schools), edit `handle_new_user()` in the functions migration, then promote teachers manually:
  `update public.profiles set role = 'teacher' where id = '<user-id>';`
  Make an admin the same way with `'admin'`.
- Because the AI Coach may be used by minors, review your local child-privacy rules (e.g. parental consent) before launch.

## Project layout

```
src/                     React app (pages per role, shared UI)
supabase/migrations/     schema, functions, RLS
supabase/functions/      ai-coach edge function
supabase/seed.sql        optional demo course
.github/workflows/       CI, GitHub Pages deploy, Supabase deploy
```

## Roadmap ideas

Attendance UI (table exists), notifications, leaderboards, certificates, file uploads (Supabase Storage),
offline mode, school/class management UI, per-school admin dashboards.

Design inspired by the E-Study dashboard style (green, soft cards, left sidebar). Replace with your own branding before launch.
