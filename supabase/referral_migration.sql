-- ============================================================================
-- OFFMUTE invite / referral program
-- Run this once in the Supabase SQL editor. Safe to re-run.
--
-- Every profile gets a short invite code (written by the client on demand).
-- A new account that signs up through ?invite=CODE writes one row into
-- public.referrals. Points are derived from those rows (10 per invite), so
-- there is no balance to drift out of sync.
-- ============================================================================

alter table public.profiles
  add column if not exists invite_code text;

alter table public.profiles
  drop constraint if exists profiles_invite_code_format;
alter table public.profiles
  add constraint profiles_invite_code_format
  check (invite_code is null or invite_code ~ '^OM[A-Z0-9]{4,10}$');

create unique index if not exists profiles_invite_code_idx
  on public.profiles (invite_code)
  where invite_code is not null;

create table if not exists public.referrals (
  id          uuid primary key default gen_random_uuid(),
  inviter_id  uuid not null references public.profiles (id) on delete cascade,
  invited_id  uuid not null unique references public.profiles (id) on delete cascade,
  code        text not null,
  points      int not null default 10 check (points between 0 and 1000),
  created_at  timestamptz not null default now(),
  constraint referrals_no_self check (inviter_id <> invited_id)
);

create index if not exists referrals_inviter_idx
  on public.referrals (inviter_id, created_at desc);

-- The code must actually belong to the inviter (not just any profile id).
create or replace function public.validate_referral()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = new.inviter_id and invite_code = new.code
  ) then
    raise exception 'Invalid invite code';
  end if;
  return new;
end;
$$;

drop trigger if exists referrals_validate on public.referrals;
create trigger referrals_validate
  before insert on public.referrals
  for each row execute function public.validate_referral();

alter table public.referrals enable row level security;

drop policy if exists "referrals: view own" on public.referrals;
create policy "referrals: view own" on public.referrals
  for select to authenticated
  using (inviter_id = auth.uid() or invited_id = auth.uid());

drop policy if exists "referrals: claim as invited" on public.referrals;
create policy "referrals: claim as invited" on public.referrals
  for insert to authenticated
  with check (invited_id = auth.uid() and inviter_id <> auth.uid());

grant select, insert on public.referrals to authenticated;

-- Quick check after running:
--   select p.handle, count(r.*) as invites, count(r.*) * 10 as points
--   from public.profiles p
--   left join public.referrals r on r.inviter_id = p.id
--   group by p.handle order by points desc limit 10;
