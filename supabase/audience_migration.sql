-- ============================================================================
-- OFFMUTE — Student audience migration
-- Idempotent: safe to run multiple times on an existing project.
-- Adds the student categories and communities used by the Student mode
-- (see src/lib/audience.ts). Run this once in the Supabase SQL editor for
-- projects created before Student mode existed.
-- ============================================================================

begin;

-- Separate Student and Corporate feeds at the post level. Existing posts
-- become 'corporate' (the original audience) while new posts store the
-- audience they were written in.
alter table public.posts add column if not exists audience
  text not null default 'corporate';
alter table public.posts drop constraint if exists posts_audience_check;
alter table public.posts add constraint posts_audience_check
  check (audience in ('student', 'corporate'));
create index if not exists posts_audience_idx
  on public.posts (audience, created_at desc);

insert into public.categories (slug, name, description) values
  ('campus-life',        'Campus Life',        'Hostel, fests, attendance, friend groups and campus chaos.'),
  ('exams-placements',   'Exams & Placements', 'Semester exams, aptitude prep, placement season survival.'),
  ('internships',        'Internships',        'Finding internships, stipends, first-day nerves and PPOs.'),
  ('study-hacks',        'Study Hacks',        'Notes, focus tricks, resources and last-night saves.'),
  ('campus-confessions', 'Campus Confessions', 'Crushes, canteen stories and things you never told your class.')
on conflict (slug) do nothing;

insert into public.communities (slug, name, description, is_restricted) values
  ('college-life',       'College Life',       'Campus, hostel, fests, attendance and the everyday chaos of college.', false),
  ('placements',         'Placements',         'Placement season, aptitude rounds, interviews and offer stories.', false),
  ('internships',        'Internships',        'Internship leads, stipend talk, first-day nerves and PPO wins.', false),
  ('exam-war-room',      'Exam War Room',      'Exam prep, study plans, resources and last-minute rescue threads.', false),
  ('campus-confessions', 'Campus Confessions', 'Anonymous campus stories you would never post with your name. Restricted.', true)
on conflict (slug) do nothing;

insert into public.community_rules (community_id, content, sort_order)
select c.id, rule.content, rule.sort_order
from public.communities c
join (values
  ('campus-confessions', 'Keep it anonymous: never name classmates, teachers or share private info.', 1),
  ('campus-confessions', 'Confess your own experiences. No targeting or bullying.', 2),
  ('campus-confessions', 'Support each other. No harassment or doxxing of any kind.', 3),
  ('exam-war-room', 'Share what actually worked. No paid or pirated material.', 1),
  ('exam-war-room', 'Be kind to people panicking. Everyone has been there.', 2)
) as rule (slug, content, sort_order)
on rule.slug = c.slug
where not exists (
  select 1 from public.community_rules r
  where r.community_id = c.id and r.content = rule.content
);

commit;
