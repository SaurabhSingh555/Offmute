# OFFMUTE

> **Life has a filter. Here, you can let it out.**

OFFMUTE is an anonymous social platform with two modes — **Student** and **Corporate**:
campus/office confessions, humor, career and placement talk, community discussions, polls,
follows, blocks and reports — behind a pseudonymous handle, never a real name.

## Stack

| Layer | Tech |
| --- | --- |
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS 4 + Framer Motion + Lucide |
| Backend | Supabase: Auth, PostgreSQL (+ RLS), Storage, Realtime |
| Hosting | Any static host (Vercel guide below) |

**The frontend needs two required environment variables** — no service-role key and no backend:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY

# Optional: Gemini-generated "community replies" for new posts.
VITE_GEMINI_API_KEY=
VITE_GEMINI_MODEL=gemini-3.1-flash-lite
```

A copy lives in [`.env.example`](.env.example). The Gemini key is optional; without it the app
works normally, just without simulated replies.

## Quickstart

1. **Create a Supabase project** at [supabase.com](https://supabase.com).
2. **Run the migration**: Dashboard → *SQL Editor* → *New query* → paste the entire
   [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
   This creates all tables, indexes, constraints, triggers, RLS policies, storage buckets and
   policies, the realtime publication, grants, and seed data (17 categories, 19 communities).
   It is idempotent — safe to re-run.
   - **Upgrading an existing project?** Also run
     [`supabase/audience_migration.sql`](supabase/audience_migration.sql) to add the Student
     categories and communities. It is idempotent too.
3. **One-time dashboard checks** (SQL cannot do these for you):
   - *Authentication → Sign In / Up → Email*: enabled.
   - *Authentication → URL Configuration*: **Site URL** = your app URL; add the same URL to
     **Redirect URLs** (for password-reset emails).
   - *(Optional)* *Authentication → Providers → SMTP/Resend*: configure delivery if you don't
     want to use the Supabase inbox for dev links.
   - *(Optional)* *Authentication → Providers → Email → "Confirm email"*. If disabled, signup
     signs in immediately; if enabled, users must confirm first (the app handles both).
4. **Run the frontend**:
   ```bash
   cp .env.example .env   # fill in your two values
   npm install
   npm run dev
   ```
5. Deploy (below) or build: `npm run build` → `dist/`.

## Deploying to Vercel

1. Push the repo to GitHub and import it in Vercel (framework: **Vite** — defaults are fine).
2. In *Project Settings → Environment Variables* add the two variables above for
   **Production / Preview / Development**.
3. SPA rewrites: create `vercel.json`:
   ```json
   { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
   ```
4. Deploy. Set the same URL as Site URL / redirect URL in Supabase.
   If you change the domain later, update Supabase's URL configuration.

## Security model (all enforced in `schema.sql`)

- **RLS is ON on every table.** Policies are `to authenticated` only; there is no anon data access.
- **Own-content rule**: users can only insert/update/delete rows where `user_id = auth.uid()`
  (posts, comments, bookmarks, blocks, prefs). `user_id` cannot be spoofed — insert policies
  pin it to `auth.uid()`, and profiles can only be created for `id = auth.uid()`.
- **Privacy**: bookmarks, notifications and preferences are readable only by the owner.
  Follow edges are readable only by the two participants (privacy-preserving counts).
  The `profiles` table contains *no email column* — public queries can only ever return
  handle / avatar / bio.
- **Restricted communities**: post/comment/message read + membership list are gated by
  `community_members`; joining is only allowed for open communities (or own restricted ones).
  Enforced in RLS, not the UI.
- **Roles**: the `owner` row in `community_members` is only ever created by a `SECURITY
  DEFINER` trigger on community creation — members cannot self-assign `owner`.
- **Reports**: readable only by the reporter and (for community reports) that community's owner.
  The reported user can never read reports about them.
- **Blocks**: hide the blocker's view of the blocked user's posts/comments/messages in every
  read policy, and notification triggers check both block directions.
- **Storage**: two public buckets (`post-images`, `avatars`) whose upload/update/delete policies
  require `foldername = auth.uid()::text` and image extensions; file type + ≤5MB validated in
  the client too.
- **Spam prevention**: DB triggers raise exceptions past 6 posts / 20 comments per 5 min and
  12 messages per minute.
- **Account deletion**: `offmute_delete_account()` (execute granted to `authenticated` only)
  wipes all user data, storage objects and the auth row in a `SECURITY DEFINER` function.
- **Realtime** is scoped per-user (`user_id=eq.…`) / per-community (`community_id=eq.…`) and
  RLS applies to broadcast rows, so you only ever receive what you can read.

### Verifying RLS by hand (SQL Editor)

After creating two test users (sign up twice in the app):

```sql
-- as user A (supabase auth: sign in as A, or use a pgTAP suite in CI)
-- these should all FAIL with "row-level security violation":
insert into public.profiles (id, handle) values ('<userB_id>', 'EvilSpoof');
select * from public.notifications where user_id = '<userB_id>';
select * from public.posts where community_id = '<restricted_community_id>'; -- without membership
insert into public.community_members (community_id, user_id, role)
values ('<community_id>', '<userA_id>', 'owner');   -- self-assigning owner: blocked
```

## Tests

Unit tests (run with `npx vitest run` or `npm test`-style):

```bash
npx vitest run
```

Covered: handle generation (shape + uniqueness distribution), handle validation, slugify,
hash determinism (stable avatars), poll percentage math, image validation, relative time.
Database-level flows (RLS, restricted communities, ownership) are covered by the policies and
trigger exceptions above — verify them with the snippets in your own project.

### Manual acceptance checklist

- [ ] Signup → confirmation email (if enabled) → sign in → auto-generated handle
- [ ] Post text + image + poll → vote → change vote
- [ ] Like / unlike, bookmark, comment + reply, delete own comment
- [ ] Join / leave restricted community → posts hidden for non-members
- [ ] Create community (+rules) → appear in Explore → delete (owner)
- [ ] Follow → "post" notification appears (realtime badge)
- [ ] Report a post → visible in Settings → your reports
- [ ] Block a user → their posts disappear from your feed
- [ ] Change handle / bio / avatar → reflected everywhere
- [ ] Delete account → everything gone, sign-out forced

## Audience modes (Student / Corporate)

The landing page asks whether you are a student or working professional and stores the choice in
`localStorage` (`src/lib/audience.ts`). The choice drives:

- the landing hero/features/steps and sample posts,
- the feed tabs (student tabs: Campus Life, Exams & Placements, Internships, Study Hacks,
  Campus Confessions),
- the categories shown in the composer and Explore,
- the communities offered during onboarding,
- the voice used by the Gemini reply generator.

You can switch modes anytime from the landing header, the desktop sidebar, or the mobile header.
Default is Corporate when nothing is chosen.

## Simulated community replies (optional, Gemini)

New posts can be seeded with a few short replies from different anonymous handles so the thread
does not feel dead (`src/lib/aiReplies.ts` + `src/lib/gemini.ts`).

- Runs only when `VITE_GEMINI_API_KEY` is set; model defaults to `gemini-3.1-flash-lite`.
- Replies are **client-side only** (cached in `localStorage` under `om-ai-replies`). They are not
  written to Supabase, because RLS correctly forbids posting as other users.
- The author's own empty post generates replies on creation and again the first time it is opened.
- AI replies are merged into the post detail thread and counted on feed cards, but cannot be
  replied to or deleted, and have no profile links.
- **Security note:** this is a static app, so the key ships in the browser bundle. For a public
  launch, proxy Gemini through a serverless function and keep the key server-side.

## Sample content (so new signups never see a blank feed)

No separate demo accounts exist in your database. Instead, the app ships a **client-side sample
catalog** (`src/lib/demoContent.ts`): ~40 corporate and ~14 student posts with comments and polls.

- Sample posts are filtered by the selected audience and by feed context.
- Whenever a feed context is **empty** (Latest / For You / Trending / any category tab / any
  community), the sample posts for that context are shown in place of an empty state.
- The moment **real posts** exist in that context, they replace the samples — samples never mix
  with real content.
- Sample posts carry a small **sample** badge. Likes, bookmarks and poll votes on them work and
  persist in your browser (localStorage) so the experience feels interactive, but nothing is
  written to the database and no demo users exist (search, profiles and notifications are
  unaffected).
- Sample post links (`/post/demo-…` and `/post/student-…`) render fully with their sample comments.

To change or remove the sample content, edit `src/lib/demoContent.ts`.

## What is intentionally out of scope

- **Platform-level moderation UI**: community owners review reports on their community in-app.
  Platform-wide review of post/user reports is done with the SQL Editor (or an admin tool):
  ```sql
  select * from public.reports where status = 'pending' order by created_at desc limit 50;
  ```
- Global (non-community) realtime chat; realtime is used for notifications + community rooms.
- Email delivery templates (Supabase Auth defaults are used).
- No absolute-anonymity claim: public pseudonymity protects you from other users, not from
  account compromise, privileged platform access or legal process.

## Project structure

```
supabase/schema.sql             # full migration: tables, RLS, triggers, storage, seed
supabase/audience_migration.sql # additive Student categories/communities (existing projects)
src/lib/supabase.ts             # client (Supabase env vars)
src/lib/audience.ts             # Student/Corporate modes, tabs and config
src/lib/queries.ts              # every Supabase query, typed + bounded
src/lib/demoContent.ts          # client-side sample catalog
src/lib/gemini.ts               # optional Gemini REST client
src/lib/aiReplies.ts            # simulated reply generation/cache/merge
src/context/AppProviders.tsx    # auth + theme + toasts
src/components/                 # design system, layout, post card, composer
src/pages/                      # route pages (lazy-loaded)
src/lib/__tests__/              # vitest unit tests
```
