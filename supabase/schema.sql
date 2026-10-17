-- ============================================================================
-- OFFMUTE — complete Supabase migration
-- Run this ENTIRE file in: Supabase Dashboard → SQL Editor → New query → Run
--
-- The frontend only needs VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY.
-- All authorization lives here: RLS policies, CHECK constraints, and
-- SECURITY DEFINER functions. No service-role key is ever used by the app.
-- ============================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ============================================================================
-- 1. TABLES
-- ============================================================================

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  handle      text not null unique check (handle ~ '^[A-Za-z][A-Za-z0-9_]{2,23}$'),
  avatar_url  text,
  bio         text default '' check (char_length(bio) <= 160),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.categories (
  id          serial primary key,
  slug        text not null unique,
  name        text not null,
  description text
);

create table if not exists public.communities (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,47}$'),
  name          text not null check (char_length(name) between 2 and 60),
  description   text check (char_length(coalesce(description, '')) <= 300),
  is_restricted boolean not null default false,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

create table if not exists public.community_members (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'member')),
  joined_at    timestamptz not null default now(),
  primary key (community_id, user_id)
);

create table if not exists public.community_rules (
  id          uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  content     text not null check (char_length(content) between 3 and 160),
  sort_order  int not null default 0
);

create table if not exists public.posts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  community_id uuid references public.communities (id) on delete set null,
  category_id  int references public.categories (id) on delete set null,
  body         text not null check (char_length(body) between 1 and 2000),
  image_url    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.comments (
  id                uuid primary key default gen_random_uuid(),
  post_id           uuid not null references public.posts (id) on delete cascade,
  user_id           uuid not null references public.profiles (id) on delete cascade,
  parent_comment_id uuid references public.comments (id) on delete cascade,
  body              text not null check (char_length(body) between 1 and 1000),
  created_at        timestamptz not null default now()
);

create table if not exists public.likes (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.bookmarks (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create table if not exists public.polls (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null unique references public.posts (id) on delete cascade,
  question   text check (char_length(coalesce(question, '')) <= 200),
  created_at timestamptz not null default now()
);

create table if not exists public.poll_options (
  id         uuid primary key default gen_random_uuid(),
  poll_id    uuid not null references public.polls (id) on delete cascade,
  label      text not null check (char_length(label) between 1 and 100),
  sort_order int not null default 0
);

create table if not exists public.poll_votes (
  id        uuid primary key default gen_random_uuid(),
  poll_id   uuid not null references public.polls (id) on delete cascade,
  option_id uuid not null references public.poll_options (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  unique (poll_id, user_id)
);

create table if not exists public.community_messages (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  body         text not null check (char_length(body) between 1 and 1000),
  created_at   timestamptz not null default now()
);

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  actor_id     uuid references public.profiles (id) on delete set null,
  type         text not null check (type in ('like', 'comment', 'follow', 'post')),
  post_id      uuid references public.posts (id) on delete cascade,
  comment_id   uuid references public.comments (id) on delete cascade,
  community_id uuid references public.communities (id) on delete cascade,
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);

create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment', 'user', 'community')),
  target_id   uuid not null,
  reason      text not null check (char_length(reason) between 3 and 160),
  details     text check (char_length(coalesce(details, '')) <= 500),
  status      text not null default 'pending' check (status in ('pending', 'resolved', 'dismissed')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.user_preferences (
  user_id        uuid primary key references public.profiles (id) on delete cascade,
  likes_notifs   boolean not null default true,
  comment_notifs boolean not null default true,
  follow_notifs  boolean not null default true,
  post_notifs    boolean not null default true
);

-- ============================================================================
-- 2. INDEXES (feed queries, lookups, search)
-- ============================================================================

create index if not exists posts_created_idx        on public.posts (created_at desc);
create index if not exists posts_user_idx           on public.posts (user_id, created_at desc);
create index if not exists posts_community_idx      on public.posts (community_id, created_at desc);
create index if not exists posts_category_idx       on public.posts (category_id, created_at desc);
create index if not exists posts_body_trgm_idx      on public.posts using gin (body gin_trgm_ops);
create index if not exists comments_post_idx        on public.comments (post_id, created_at);
create index if not exists comments_user_idx        on public.comments (user_id, created_at);
create index if not exists comments_parent_idx      on public.comments (parent_comment_id);
create index if not exists likes_post_idx           on public.likes (post_id);
create index if not exists bookmarks_user_idx       on public.bookmarks (user_id, created_at desc);
create index if not exists follows_followee_idx     on public.follows (followee_id);
create index if not exists members_user_idx         on public.community_members (user_id);
create index if not exists poll_votes_poll_idx      on public.poll_votes (poll_id, option_id);
create index if not exists messages_community_idx   on public.community_messages (community_id, created_at desc);
create index if not exists notif_user_idx           on public.notifications (user_id, created_at desc);
create index if not exists notif_unread_idx         on public.notifications (user_id) where read_at is null;
create index if not exists reports_target_idx       on public.reports (target_type, target_id);
create index if not exists reports_status_idx       on public.reports (status);
create index if not exists profiles_handle_trgm_idx on public.profiles using gin (handle gin_trgm_ops);
create index if not exists communities_name_trgm_idx on public.communities using gin (name gin_trgm_ops);
create index if not exists communities_created_idx  on public.communities (created_at desc);

-- ============================================================================
-- 3. FUNCTIONS
-- ============================================================================

-- Pseudonymous handle generator (e.g. SilentPanda47)
create or replace function public.generate_handle()
returns text language sql stable as $$
  select
    (select w from (values ('Silent'), ('Night'), ('Coffee'), ('Broken'), ('Quiet'),
      ('Midnight'), ('Paper'), ('Ghost'), ('Lucky'), ('Lowkey'), ('Standup'),
      ('Overtime'), ('Backlog'), ('Desk'), ('Ping'), ('Deploy')) v (w) order by random() limit 1)
    || (select a from (values ('Panda'), ('Fox'), ('Heron'), ('Otter'), ('Lynx'),
      ('Mole'), ('Raven'), ('Gecko'), ('Badger'), ('Moth'), ('Koi'), ('Crane'),
      ('Marmot'), ('Orca'), ('Shrew'), ('Newt')) w (a) order by random() limit 1)
    || (10 + floor(random() * 90))::text;
$$;

-- Auto-create profile + preferences on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_handle text;
begin
  -- If the profile already exists (seeded, or a retry) leave it untouched.
  if exists (select 1 from public.profiles where id = new.id) then
    return new;
  end if;
  new_handle := public.generate_handle();
  loop
    begin
      insert into public.profiles (id, handle) values (new.id, new_handle);
      exit;
    exception when unique_violation then
      new_handle := public.generate_handle();
    end;
  end loop;
  insert into public.user_preferences (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep owner as the ONLY way to obtain the community owner role
create or replace function public.become_community_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is not null then
    insert into public.community_members (community_id, user_id, role)
    values (new.id, new.created_by, 'owner')
    on conflict (community_id, user_id) do update set role = 'owner';
  end if;
  return new;
end
$$;

drop trigger if exists community_owner_created on public.communities;
create trigger community_owner_created
  after insert on public.communities
  for each row execute function public.become_community_owner();

-- Timestamps
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists posts_touch on public.posts;
create trigger posts_touch before update on public.posts
  for each row execute function public.touch_updated_at();

-- Visibility helper used by several policies (invoker rights: respects RLS)
create or replace function public.can_see_post(target_id uuid)
returns boolean language sql stable security invoker as $$
  select exists (
    select 1 from public.posts p
    where p.id = target_id
      and (
        p.user_id = auth.uid()
        or (
          p.community_id is null
          or exists (
            select 1 from public.communities c
            where c.id = p.community_id
              and (
                not c.is_restricted
                or exists (
                  select 1 from public.community_members m
                  where m.community_id = c.id and m.user_id = auth.uid()
                )
              )
          )
        )
      )
  );
$$;

-- ---------------- Spam / rate-limiting triggers (DB-level) ----------------

create or replace function public.tg_posts_rate()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.posts
      where user_id = new.user_id and created_at > now() - interval '5 minutes') >= 6 then
    raise exception 'You are posting too quickly. Please slow down for 5 minutes.' using errcode = 'P0001';
  end if;
  return new;
end
$$;

drop trigger if exists posts_rate on public.posts;
create trigger posts_rate before insert on public.posts
  for each row execute function public.tg_posts_rate();

create or replace function public.tg_comments_rate()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.comments
      where user_id = new.user_id and created_at > now() - interval '5 minutes') >= 20 then
    raise exception 'You are commenting too quickly. Please slow down.' using errcode = 'P0001';
  end if;
  return new;
end
$$;

drop trigger if exists comments_rate on public.comments;
create trigger comments_rate before insert on public.comments
  for each row execute function public.tg_comments_rate();

create or replace function public.tg_messages_rate()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.community_messages
      where user_id = new.user_id and created_at > now() - interval '1 minute') >= 12 then
    raise exception 'You are sending messages too quickly.' using errcode = 'P0001';
  end if;
  return new;
end
$$;

drop trigger if exists messages_rate on public.community_messages;
create trigger messages_rate before insert on public.community_messages
  for each row execute function public.tg_messages_rate();

-- ---------------- Notification triggers (DB-side, definer) ----------------

create or replace function public.tg_like_notif()
returns trigger language plpgsql security definer set search_path = public as $$
declare author uuid;
begin
  select user_id into author from public.posts where id = new.post_id;
  if author is null or author = new.user_id then
    return new;
  end if;
  if exists (select 1 from public.blocks b
             where (b.blocker_id = author and b.blocked_id = new.user_id)
                or (b.blocker_id = new.user_id and b.blocked_id = author)) then
    return new;
  end if;
  if (select coalesce(likes_notifs, true) from public.user_preferences where user_id = author) then
    insert into public.notifications (user_id, actor_id, type, post_id)
    values (author, new.user_id, 'like', new.post_id);
  end if;
  return new;
end
$$;

drop trigger if exists likes_notif on public.likes;
create trigger likes_notif after insert on public.likes
  for each row execute function public.tg_like_notif();

create or replace function public.tg_comment_notif()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  post_author uuid;
  parent_author uuid;
begin
  select p.user_id into post_author from public.posts p where p.id = new.post_id;
  if new.parent_comment_id is not null then
    select user_id into parent_author from public.comments c where c.id = new.parent_comment_id;
  end if;
  if post_author is not null and post_author <> new.user_id then
    if not exists (select 1 from public.blocks b
                   where (b.blocker_id = post_author and b.blocked_id = new.user_id)
                      or (b.blocker_id = new.user_id and b.blocked_id = post_author))
       and (select coalesce(comment_notifs, true) from public.user_preferences where user_id = post_author) then
      insert into public.notifications (user_id, actor_id, type, post_id, comment_id)
      values (post_author, new.user_id, 'comment', new.post_id, new.id);
    end if;
  end if;
  if parent_author is not null and parent_author <> new.user_id and parent_author is distinct from post_author then
    if not exists (select 1 from public.blocks b
                   where (b.blocker_id = parent_author and b.blocked_id = new.user_id)
                      or (b.blocker_id = new.user_id and b.blocked_id = parent_author))
       and (select coalesce(comment_notifs, true) from public.user_preferences where user_id = parent_author) then
      insert into public.notifications (user_id, actor_id, type, post_id, comment_id)
      values (parent_author, new.user_id, 'comment', new.post_id, new.id);
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists comments_notif on public.comments;
create trigger comments_notif after insert on public.comments
  for each row execute function public.tg_comment_notif();

create or replace function public.tg_follow_notif()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.blocks b
                 where (b.blocker_id = new.followee_id and b.blocked_id = new.follower_id)
                    or (b.blocker_id = new.follower_id and b.blocked_id = new.followee_id))
     and (select coalesce(follow_notifs, true) from public.user_preferences where user_id = new.followee_id) then
    insert into public.notifications (user_id, actor_id, type)
    values (new.followee_id, new.follower_id, 'follow');
  end if;
  return new;
end
$$;

drop trigger if exists follows_notif on public.follows;
create trigger follows_notif after insert on public.follows
  for each row execute function public.tg_follow_notif();

create or replace function public.tg_post_notif()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, actor_id, type, post_id)
  select f.follower_id, new.user_id, 'post', new.id
  from public.follows f
  where f.followee_id = new.user_id
    and not exists (select 1 from public.blocks b
                    where (b.blocker_id = f.follower_id and b.blocked_id = new.user_id)
                       or (b.blocker_id = new.user_id and b.blocked_id = f.follower_id))
    and (select coalesce(post_notifs, true) from public.user_preferences where user_id = f.follower_id);
  return new;
end
$$;

drop trigger if exists posts_notif on public.posts;
create trigger posts_notif after insert on public.posts
  for each row execute function public.tg_post_notif();

-- ---------------- Account deletion (self-service, definer) ----------------
-- Removes every row the user owns (storage objects + the auth.users row are
-- attempted in nested transactions so a grant difference cannot brick the rest).

create or replace function public.offmute_delete_account()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  auth_removed boolean := false;
  storage_removed boolean := false;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.posts where user_id = me;
  delete from public.comments where user_id = me;
  delete from public.likes where user_id = me;
  delete from public.bookmarks where user_id = me;
  delete from public.follows where follower_id = me or followee_id = me;
  delete from public.blocks where blocker_id = me or blocked_id = me;
  delete from public.reports where reporter_id = me;
  delete from public.notifications where user_id = me or actor_id = me;
  delete from public.community_messages where user_id = me;
  delete from public.community_members where user_id = me;
  delete from public.community_rules r
  where exists (select 1 from public.communities c where c.id = r.community_id and c.created_by = me);
  delete from public.communities where created_by = me;
  delete from public.user_preferences where user_id = me;
  delete from public.profiles where id = me;

  begin
    delete from storage.objects o
    where o.bucket_id in ('post-images', 'avatars')
      and (storage.foldername(o.name))[1] = me::text;
    storage_removed := true;
  exception when others then
    storage_removed := false;
  end;

  begin
    delete from auth.users where id = me;
    auth_removed := true;
  exception when others then
    auth_removed := false;
  end;

  return jsonb_build_object(
    'data_removed', true,
    'auth_removed', auth_removed,
    'storage_removed', storage_removed
  );
end
$$;

-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================

alter table public.profiles            enable row level security;
alter table public.categories          enable row level security;
alter table public.communities         enable row level security;
alter table public.community_members   enable row level security;
alter table public.community_rules     enable row level security;
alter table public.posts               enable row level security;
alter table public.comments            enable row level security;
alter table public.likes               enable row level security;
alter table public.bookmarks           enable row level security;
alter table public.follows             enable row level security;
alter table public.polls               enable row level security;
alter table public.poll_options        enable row level security;
alter table public.poll_votes          enable row level security;
alter table public.community_messages  enable row level security;
alter table public.notifications       enable row level security;
alter table public.reports             enable row level security;
alter table public.blocks              enable row level security;
alter table public.user_preferences    enable row level security;

-- profiles (only pseudonymous fields exist in this table; no emails)
drop policy if exists "profiles: view pseudonymous profile" on public.profiles;
create policy "profiles: view pseudonymous profile" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles: create own" on public.profiles;
create policy "profiles: create own" on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "profiles: delete own" on public.profiles;
create policy "profiles: delete own" on public.profiles
  for delete to authenticated using (id = auth.uid());

-- categories: read-only
drop policy if exists "categories: read" on public.categories;
create policy "categories: read" on public.categories
  for select to authenticated using (true);

-- communities
drop policy if exists "communities: read" on public.communities;
create policy "communities: read" on public.communities
  for select to authenticated using (true);

drop policy if exists "communities: create own" on public.communities;
create policy "communities: create own" on public.communities
  for insert to authenticated with check (created_by = auth.uid());

drop policy if exists "communities: update own" on public.communities;
create policy "communities: update own" on public.communities
  for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "communities: delete own" on public.communities;
create policy "communities: delete own" on public.communities
  for delete to authenticated using (created_by = auth.uid());

-- community_members
drop policy if exists "members: view" on public.community_members;
create policy "members: view" on public.community_members
  for select to authenticated using (
    user_id = auth.uid()
    or not exists (select 1 from public.communities c
                   where c.id = community_members.community_id and c.is_restricted)
    or exists (select 1 from public.communities c
               where c.id = community_members.community_id and c.created_by = auth.uid())
  );

-- Joining: must be yourself; owner role can NEVER be self-assigned (the
-- owner row is only ever created by the become_community_owner trigger).
drop policy if exists "members: join" on public.community_members;
create policy "members: join" on public.community_members
  for insert to authenticated with check (
    user_id = auth.uid()
    and role = 'member'
    and exists (select 1 from public.communities c
                where c.id = community_members.community_id
                  and (not c.is_restricted or c.created_by = auth.uid()))
  );

drop policy if exists "members: leave or owner manage" on public.community_members;
create policy "members: leave or owner manage" on public.community_members
  for delete to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.communities c
               where c.id = community_members.community_id and c.created_by = auth.uid())
  );

-- Role changes only by the community owner (no self-promotion)
drop policy if exists "members: owner role management" on public.community_members;
create policy "members: owner role management" on public.community_members
  for update to authenticated
  using (exists (select 1 from public.communities c
                 where c.id = community_members.community_id and c.created_by = auth.uid()))
  with check (exists (select 1 from public.communities c
                      where c.id = community_members.community_id and c.created_by = auth.uid()));

-- community_rules
drop policy if exists "rules: view" on public.community_rules;
create policy "rules: view" on public.community_rules
  for select to authenticated using (
    exists (select 1 from public.community_members m
            where m.community_id = community_rules.community_id and m.user_id = auth.uid())
    or not exists (select 1 from public.communities c
                   where c.id = community_rules.community_id and c.is_restricted)
    or exists (select 1 from public.communities c
               where c.id = community_rules.community_id and c.created_by = auth.uid())
  );

drop policy if exists "rules: owner manage" on public.community_rules;
create policy "rules: owner manage" on public.community_rules
  for insert to authenticated with check (
    exists (select 1 from public.communities c
            where c.id = community_rules.community_id and c.created_by = auth.uid())
  );

drop policy if exists "rules: owner update" on public.community_rules;
create policy "rules: owner update" on public.community_rules
  for update to authenticated
  using (exists (select 1 from public.communities c
                 where c.id = community_rules.community_id and c.created_by = auth.uid()))
  with check (exists (select 1 from public.communities c
                      where c.id = community_rules.community_id and c.created_by = auth.uid()));

drop policy if exists "rules: owner delete" on public.community_rules;
create policy "rules: owner delete" on public.community_rules
  for delete to authenticated using (
    exists (select 1 from public.communities c
            where c.id = community_rules.community_id and c.created_by = auth.uid())
  );

-- posts: public unless inside a restricted community you are not a member of;
-- posts of users you block (or that block you) are hidden.
drop policy if exists "posts: read" on public.posts;
create policy "posts: read" on public.posts
  for select to authenticated using (
    user_id = auth.uid()
    or (
      (
        community_id is null
        or exists (select 1 from public.communities c where c.id = posts.community_id
                   and (not c.is_restricted
                        or exists (select 1 from public.community_members m
                                   where m.community_id = c.id and m.user_id = auth.uid())))
      )
      and not exists (select 1 from public.blocks b
                      where b.blocker_id = auth.uid() and b.blocked_id = posts.user_id)
      and not exists (select 1 from public.blocks b
                      where b.blocked_id = auth.uid() and b.blocker_id = posts.user_id)
    )
  );

drop policy if exists "posts: create" on public.posts;
create policy "posts: create" on public.posts
  for insert to authenticated with check (
    user_id = auth.uid()
    and (community_id is null
         or exists (select 1 from public.community_members m
                    where m.community_id = posts.community_id and m.user_id = auth.uid()))
  );

drop policy if exists "posts: edit own" on public.posts;
create policy "posts: edit own" on public.posts
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "posts: delete own" on public.posts;
create policy "posts: delete own" on public.posts
  for delete to authenticated using (user_id = auth.uid());

-- comments
drop policy if exists "comments: read" on public.comments;
create policy "comments: read" on public.comments
  for select to authenticated using (
    user_id = auth.uid()
    or (
      exists (select 1 from public.posts p where p.id = comments.post_id
              and (p.community_id is null
                   or exists (select 1 from public.communities c where c.id = p.community_id
                              and (not c.is_restricted
                                   or exists (select 1 from public.community_members m
                                              where m.community_id = c.id and m.user_id = auth.uid())))))
      and not exists (select 1 from public.blocks b
                      where b.blocker_id = auth.uid() and b.blocked_id = comments.user_id)
      and not exists (select 1 from public.blocks b
                      where b.blocked_id = auth.uid() and b.blocker_id = comments.user_id)
    )
  );

drop policy if exists "comments: create" on public.comments;
create policy "comments: create" on public.comments
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.posts p where p.id = comments.post_id
                and (p.community_id is null
                     or exists (select 1 from public.community_members m
                                where m.community_id = p.community_id and m.user_id = auth.uid())))
  );

drop policy if exists "comments: edit own" on public.comments;
create policy "comments: edit own" on public.comments
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "comments: delete own" on public.comments;
create policy "comments: delete own" on public.comments
  for delete to authenticated using (user_id = auth.uid());

-- likes: readable (needed for public engagement counts; data is pseudonymous)
drop policy if exists "likes: read" on public.likes;
create policy "likes: read" on public.likes
  for select to authenticated using (true);

drop policy if exists "likes: own" on public.likes;
create policy "likes: own" on public.likes
  for insert to authenticated with check (user_id = auth.uid() and public.can_see_post(post_id));

drop policy if exists "likes: delete own" on public.likes;
create policy "likes: delete own" on public.likes
  for delete to authenticated using (user_id = auth.uid());

-- bookmarks: private
drop policy if exists "bookmarks: own" on public.bookmarks;
create policy "bookmarks: own" on public.bookmarks
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "bookmarks: create own" on public.bookmarks;
create policy "bookmarks: create own" on public.bookmarks
  for insert to authenticated with check (user_id = auth.uid() and public.can_see_post(post_id));

drop policy if exists "bookmarks: delete own" on public.bookmarks;
create policy "bookmarks: delete own" on public.bookmarks
  for delete to authenticated using (user_id = auth.uid());

-- follows: you can only see edges you participate in (privacy-preserving)
drop policy if exists "follows: own edges" on public.follows;
create policy "follows: own edges" on public.follows
  for select to authenticated using (follower_id = auth.uid() or followee_id = auth.uid());

drop policy if exists "follows: follow" on public.follows;
create policy "follows: follow" on public.follows
  for insert to authenticated with check (
    follower_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = followee_id)
  );

drop policy if exists "follows: unfollow" on public.follows;
create policy "follows: unfollow" on public.follows
  for delete to authenticated using (follower_id = auth.uid());

-- polls / options / votes (visibility inherits from the parent post)
drop policy if exists "polls: read" on public.polls;
create policy "polls: read" on public.polls
  for select to authenticated using (public.can_see_post(post_id));

drop policy if exists "polls: author create" on public.polls;
create policy "polls: author create" on public.polls
  for insert to authenticated with check (
    exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid())
  );

drop policy if exists "polls: author update" on public.polls;
create policy "polls: author update" on public.polls
  for update to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid()));

drop policy if exists "options: read" on public.poll_options;
create policy "options: read" on public.poll_options
  for select to authenticated using (
    exists (select 1 from public.polls pl where pl.id = poll_options.poll_id and public.can_see_post(pl.post_id))
  );

drop policy if exists "options: author create" on public.poll_options;
create policy "options: author create" on public.poll_options
  for insert to authenticated with check (
    exists (select 1 from public.polls pl
            where pl.id = poll_options.poll_id
              and exists (select 1 from public.posts p where p.id = pl.post_id and p.user_id = auth.uid()))
  );

drop policy if exists "votes: read" on public.poll_votes;
create policy "votes: read" on public.poll_votes
  for select to authenticated using (
    exists (select 1 from public.polls pl where pl.id = poll_votes.poll_id and public.can_see_post(pl.post_id))
  );

drop policy if exists "votes: cast own" on public.poll_votes;
create policy "votes: cast own" on public.poll_votes
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.poll_options po
                where po.id = option_id and po.poll_id = poll_votes.poll_id
                  and public.can_see_post((select pl.post_id from public.polls pl where pl.id = poll_votes.poll_id)))
  );

drop policy if exists "votes: change own" on public.poll_votes;
create policy "votes: change own" on public.poll_votes
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "votes: delete own" on public.poll_votes;
create policy "votes: delete own" on public.poll_votes
  for delete to authenticated using (user_id = auth.uid());

-- community messages: membership required (Realtime is scoped by RLS too)
drop policy if exists "messages: member read" on public.community_messages;
create policy "messages: member read" on public.community_messages
  for select to authenticated using (
    exists (select 1 from public.community_members m
            where m.community_id = community_messages.community_id and m.user_id = auth.uid())
    and not exists (select 1 from public.blocks b
                    where b.blocker_id = auth.uid() and b.blocked_id = community_messages.user_id)
    and not exists (select 1 from public.blocks b
                    where b.blocked_id = auth.uid() and b.blocker_id = community_messages.user_id)
  );

drop policy if exists "messages: member write" on public.community_messages;
create policy "messages: member write" on public.community_messages
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.community_members m
                where m.community_id = community_messages.community_id and m.user_id = auth.uid())
  );

drop policy if exists "messages: delete own" on public.community_messages;
create policy "messages: delete own" on public.community_messages
  for delete to authenticated using (user_id = auth.uid());

-- notifications: strictly private
drop policy if exists "notifs: own read" on public.notifications;
create policy "notifs: own read" on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "notifs: own mark" on public.notifications;
create policy "notifs: own mark" on public.notifications
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "notifs: own delete" on public.notifications;
create policy "notifs: own delete" on public.notifications
  for delete to authenticated using (user_id = auth.uid());

-- reports: the reporter sees their own; community owners see reports on THEIR
-- community (never reports about a person they are). Nobody else can read.
drop policy if exists "reports: view" on public.reports;
create policy "reports: view" on public.reports
  for select to authenticated using (
    reporter_id = auth.uid()
    or (target_type = 'community'
        and exists (select 1 from public.communities c
                    where c.id = reports.target_id and c.created_by = auth.uid()))
  );

drop policy if exists "reports: file" on public.reports;
create policy "reports: file" on public.reports
  for insert to authenticated with check (
    reporter_id = auth.uid() and target_id is distinct from auth.uid()
  );

drop policy if exists "reports: owner resolve" on public.reports;
create policy "reports: owner resolve" on public.reports
  for update to authenticated
  using (target_type = 'community'
         and exists (select 1 from public.communities c
                     where c.id = reports.target_id and c.created_by = auth.uid()));

drop policy if exists "reports: delete own" on public.reports;
create policy "reports: delete own" on public.reports
  for delete to authenticated using (reporter_id = auth.uid());

-- blocks: visible for both directions of your own edges (needed to make
-- blocking behave consistently); nobody can read other people's block lists.
drop policy if exists "blocks: own edges" on public.blocks;
create policy "blocks: own edges" on public.blocks
  for select to authenticated using (blocker_id = auth.uid() or blocked_id = auth.uid());

drop policy if exists "blocks: create own" on public.blocks;
create policy "blocks: create own" on public.blocks
  for insert to authenticated with check (
    blocker_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = blocked_id)
  );

drop policy if exists "blocks: unblock own" on public.blocks;
create policy "blocks: unblock own" on public.blocks
  for delete to authenticated using (blocker_id = auth.uid());

-- preferences: private
drop policy if exists "prefs: own" on public.user_preferences;
create policy "prefs: own" on public.user_preferences
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "prefs: own insert" on public.user_preferences;
create policy "prefs: own insert" on public.user_preferences
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "prefs: own update" on public.user_preferences;
create policy "prefs: own update" on public.user_preferences
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "prefs: own delete" on public.user_preferences;
create policy "prefs: own delete" on public.user_preferences
  for delete to authenticated using (user_id = auth.uid());

-- ============================================================================
-- 5. STORAGE — buckets + scoped policies (created via SQL)
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true),
       ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "post images: public read" on storage.objects;
create policy "post images: public read" on storage.objects
  for select using (bucket_id = 'post-images');

drop policy if exists "post images: own upload" on storage.objects;
create policy "post images: own upload" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and storage.extension(name) in ('jpg', 'jpeg', 'png', 'webp', 'gif')
  );

drop policy if exists "post images: own update" on storage.objects;
create policy "post images: own update" on storage.objects
  for update to authenticated
  using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "post images: own delete" on storage.objects;
create policy "post images: own delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars: public read" on storage.objects;
create policy "avatars: public read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars: own upload" on storage.objects;
create policy "avatars: own upload" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and storage.extension(name) in ('jpg', 'jpeg', 'png', 'webp', 'gif')
  );

drop policy if exists "avatars: own update" on storage.objects;
create policy "avatars: own update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars: own delete" on storage.objects;
create policy "avatars: own delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- 6. REALTIME (scoped by RLS; subscriptions are bounded per page)
-- ============================================================================

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when undefined_object or duplicate_object then
  null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.community_messages;
exception when undefined_object or duplicate_object then
  null;
end
$$;

-- ============================================================================
-- 7. GRANTS
-- ============================================================================

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Privileged function: authenticated only, never anon
revoke execute on function public.offmute_delete_account() from anon;
grant execute on function public.offmute_delete_account() to authenticated;

-- ============================================================================
-- 8. SEED DATA (idempotent)
-- ============================================================================

insert into public.categories (slug, name, description) values
  ('it-software',            'IT & Software',                 'Engineering, product, QA, DevOps and everything Jira.'),
  ('bpo-support',            'BPO & Customer Support',        'Shifts, SLAs, escalations and the phone never stops.'),
  ('hr-recruitment',         'HR & Recruitment',              'Hiring loops, onboarding, offboarding and HR-ese.'),
  ('sales-marketing',        'Sales & Marketing',             'Pipelines, leads, campaigns and target season.'),
  ('corporate-memes',        'Corporate Humor',               'Meetings that could have been emails, and other jokes.'),
  ('office-confessions',     'Office Confessions',            'Things you would never say in the office, safely.'),
  ('toxic-workplaces',       'Toxic Workplace Experiences',   'Surviving culture problems. Supportive, fact-based.'),
  ('interns-freshers',       'Interns & Freshers',            'First jobs, first mistakes, first promotions.'),
  ('career-advice',          'Career Advice',                 'Switching, leveling, negotiation, growth.'),
  ('night-shift',            'Night Shift Stories',           'For the 2 AM crowd and graveyard shift legends.'),
  ('workplace-stories',      'Workplace Stories',             'Long-form war stories from the cubicle trenches.'),
  ('questions',              'Anonymous Questions',           'Ask anything work-related. Zero risk, total candor.')
on conflict (slug) do nothing;

insert into public.communities (slug, name, description, is_restricted) values
  ('it-software',        'IT & Software',                    'Everything engineering: outages, code review, Jira rituals, on-call pain.', false),
  ('bpo-support',        'BPO & Customer Support',            'Shift life, SLA drama, escalation horror stories. You are not alone.', false),
  ('hr-recruitment',     'HR & Recruitment',                  'Recruiters, HR professionals and everyone who has ever waited for a loop update.', false),
  ('sales-marketing',    'Sales & Marketing',                 'Pipelines, targets, campaigns and client call survival guides.', false),
  ('corporate-memes',    'Corporate Memes',                   'Workplace humor: the meeting, the calendar, the "quick sync".', false),
  ('office-confessions', 'Office Confessions',                'Confess work moments you would never admit at the office. Restricted to members to keep it safe.', true),
  ('toxic-workplaces',   'Toxic Workplace Experiences',       'Document and discuss culture problems constructively. No doxxing, no company names. Restricted.', true),
  ('interns-freshers',   'Interns & Freshers',                'Your first 90 days, decoded. Ask anything, fail safely, grow together.', false),
  ('career-advice',      'Career Advice',                     'Switching jobs, leveling up, negotiation and growth — no gatekeeping.', false),
  ('night-shift',        'Night Shift Stories',               'Stories from 2 AM. Coffee runs, quiet offices, strange callers.', false),
  ('noida-corporate',    'Noida Corporate',                   'Sector 62 energy: cabs, chai, deadlines and monsoon traffic.', false),
  ('bengaluru-tech',     'Bengaluru Tech',                    'Indiranagar to Whitefield: tech life, commutes and filter coffee.', false),
  ('mumbai-corporate',   'Mumbai Corporate',                  'BKC to Lower Parel: corporate life on the island city.', false),
  ('former-colleagues',  'Former Colleagues',                 'You changed jobs, not your identity. Catch up with people you once worked with.', false)
on conflict (slug) do nothing;

insert into public.community_rules (community_id, content, sort_order)
select c.id, rule.content, rule.sort_order
from public.communities c
join (values
  ('office-confessions', 'Keep it anonymous: never name real people, companies or leak private data.', 1),
  ('office-confessions', 'Confess your own experiences. No third-party accusations.', 2),
  ('office-confessions', 'Support, don't pile on. No harassment of any kind.', 3),
  ('toxic-workplaces', 'Describe patterns, not people. No company names, no doxxing.', 1),
  ('toxic-workplaces', 'Focus on behavior and culture, and what actually helped you.', 2),
  ('toxic-workplaces', 'If someone is in immediate danger, reach out to real help lines.', 3),
  ('corporate-memes', 'Roast the system, not the individuals.', 1),
  ('corporate-memes', 'No hate, no slurs, no targeting protected groups.', 2),
  ('former-colleagues', 'Introduce yourself by what you used to work on, not who you worked for.', 1),
  ('former-colleagues', 'No poaching or client solicitation.', 2)
) as rule (slug, content, sort_order)
on rule.slug = c.slug
where not exists (
  select 1 from public.community_rules r
  where r.community_id = c.id and r.content = rule.content
);

