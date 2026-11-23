-- Identity and social graph: profiles, private profile data, follows, blocks, mutes.
-- Profiles are created by public.create_profile(), never by direct insert, so the age rule
-- (mirrors packages/core/src/age.ts and ADR 0003) cannot be skipped.

create table public.reserved_usernames (
  username extensions.citext primary key
);
insert into public.reserved_usernames (username) values
  ('admin'), ('administrator'), ('funkty'), ('support'), ('help'), ('official'), ('staff'),
  ('moderator'), ('security'), ('abuse'), ('root'), ('api'), ('www'), ('settings'), ('explore'),
  ('accounts'), ('reels'), ('stories'), ('direct'), ('about'), ('privacy'), ('terms'), ('legal'),
  ('login'), ('signup'), ('notifications'), ('search'), ('p'), ('u'), ('static'), ('assets');
alter table public.reserved_usernames enable row level security;
revoke all on public.reserved_usernames from anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username extensions.citext not null unique,
  display_name text check (char_length(display_name) <= 50),
  bio text check (char_length(bio) <= 150),
  avatar_media_id uuid,
  is_private boolean not null default false,
  is_teen boolean not null default false,
  fanout_mode text not null default 'push' check (fanout_mode in ('push', 'pull')),
  account_status text not null default 'active'
    check (account_status in ('active', 'restricted', 'suspended', 'deactivated', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (
    username::text = lower(username::text)
    and username::text ~ '^[a-z0-9._]{3,30}$'
    and username::text !~ '(^\.|\.$|\.\.)'
  )
);
create index profiles_username_trgm_idx on public.profiles
  using gin ((username::text) extensions.gin_trgm_ops);
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- Date of birth and country never appear on the public profile.
create table public.profile_private (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  birth_date date not null,
  country char(2) not null check (country ~ '^[A-Z]{2}$'),
  locale text,
  created_at timestamptz not null default now()
);

-- Counters. Maintained inline by triggers in v0; moves to batched worker updates for
-- very large accounts (see architecture: hot-row avoidance).
create table public.profile_stats (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  followers_count integer not null default 0 check (followers_count >= 0),
  following_count integer not null default 0 check (following_count >= 0),
  posts_count integer not null default 0 check (posts_count >= 0)
);

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  state text not null check (state in ('pending', 'active')),
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on public.follows (followee_id, state, created_at desc);
create index follows_follower_idx on public.follows (follower_id, state, created_at desc);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);

create table public.mutes (
  muter_id uuid not null references public.profiles (id) on delete cascade,
  muted_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id),
  check (muter_id <> muted_id)
);
create index mutes_muted_idx on public.mutes (muted_id);

-- ---------------------------------------------------------------------------
-- Helper functions used by policies. SECURITY DEFINER with a fixed search_path so
-- policies stay short and cannot be redirected by a caller's search_path.
-- ---------------------------------------------------------------------------

create or replace function private.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select a is not null and b is not null and exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

create or replace function private.is_profile_visible(p_profile uuid, viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p_profile = viewer, false)
    or (
      exists (
        select 1 from public.profiles p
        where p.id = p_profile and p.account_status in ('active', 'restricted')
      )
      and not private.is_blocked_between(p_profile, viewer)
    );
$$;

-- Can the viewer see this author's content? Private accounts require an approved follow.
create or replace function private.can_view_author(author uuid, viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(author = viewer, false)
    or (
      private.is_profile_visible(author, viewer)
      and (
        not (select p.is_private from public.profiles p where p.id = author)
        or exists (
          select 1 from public.follows f
          where f.follower_id = viewer and f.followee_id = author and f.state = 'active'
        )
      )
    );
$$;

-- Mirrors packages/core/src/age.ts: 16 for EU member states until counsel verifies each
-- national value (ADR 0003), 13 everywhere else.
create or replace function private.minimum_signup_age(p_country text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when upper(p_country) = any (array[
      'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE',
      'IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'
    ]) then 16
    else 13
  end;
$$;

grant execute on function private.is_blocked_between(uuid, uuid) to anon, authenticated, service_role;
grant execute on function private.is_profile_visible(uuid, uuid) to anon, authenticated, service_role;
grant execute on function private.can_view_author(uuid, uuid) to anon, authenticated, service_role;
grant execute on function private.minimum_signup_age(text) to service_role;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Teens stay private. Switching to public accepts pending follow requests (owner decision 5).
create or replace function private.profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_teen and not new.is_private then
    raise exception 'teen_must_be_private' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and old.is_private and not new.is_private then
    update public.follows set state = 'active'
    where followee_id = new.id and state = 'pending';
  end if;
  return new;
end;
$$;
create trigger profiles_guard before insert or update on public.profiles
  for each row execute function private.profiles_guard();

create or replace function private.follows_counts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delta integer := 0;
  v_follower uuid;
  v_followee uuid;
begin
  if tg_op = 'INSERT' then
    v_follower := new.follower_id; v_followee := new.followee_id;
    if new.state = 'active' then v_delta := 1; end if;
  elsif tg_op = 'UPDATE' then
    v_follower := new.follower_id; v_followee := new.followee_id;
    if old.state <> 'active' and new.state = 'active' then v_delta := 1;
    elsif old.state = 'active' and new.state <> 'active' then v_delta := -1; end if;
  else
    v_follower := old.follower_id; v_followee := old.followee_id;
    if old.state = 'active' then v_delta := -1; end if;
  end if;
  if v_delta <> 0 then
    update public.profile_stats set following_count = greatest(following_count + v_delta, 0)
      where user_id = v_follower;
    update public.profile_stats set followers_count = greatest(followers_count + v_delta, 0)
      where user_id = v_followee;
  end if;
  return null;
end;
$$;
create trigger follows_counts after insert or update or delete on public.follows
  for each row execute function private.follows_counts();

-- ---------------------------------------------------------------------------
-- Row Level Security and privileges
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.profile_stats enable row level security;
alter table public.follows enable row level security;
alter table public.blocks enable row level security;
alter table public.mutes enable row level security;

create policy profiles_select on public.profiles for select to anon, authenticated
  using (private.is_profile_visible(id, (select auth.uid())));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy profile_private_select_own on public.profile_private for select to authenticated
  using (user_id = (select auth.uid()));

create policy profile_stats_select on public.profile_stats for select to anon, authenticated
  using (private.is_profile_visible(user_id, (select auth.uid())));

create policy follows_select on public.follows for select to authenticated
  using (
    follower_id = (select auth.uid())
    or followee_id = (select auth.uid())
    or (state = 'active' and private.can_view_author(followee_id, (select auth.uid())))
  );

create policy blocks_select_own on public.blocks for select to authenticated
  using (blocker_id = (select auth.uid()));
create policy mutes_select_own on public.mutes for select to authenticated
  using (muter_id = (select auth.uid()));

-- Clients may read; every write goes through an RPC function below.
grant select on public.profiles, public.profile_stats to anon, authenticated;
grant select on public.profile_private, public.follows, public.blocks, public.mutes to authenticated;
grant update (display_name, bio, avatar_media_id, is_private) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- RPC functions
-- ---------------------------------------------------------------------------

create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select lower(btrim(p_username)) ~ '^[a-z0-9._]{3,30}$'
    and lower(btrim(p_username)) !~ '(^\.|\.$|\.\.)'
    and not exists (
      select 1 from public.reserved_usernames r
      where r.username = lower(btrim(p_username))::extensions.citext
    )
    and not exists (
      select 1 from public.profiles p
      where p.username = lower(btrim(p_username))::extensions.citext
    );
$$;
grant execute on function public.username_available(text) to anon, authenticated;

create or replace function public.create_profile(
  p_username text,
  p_birth_date date,
  p_country text,
  p_display_name text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_username text := lower(btrim(p_username));
  v_country text := upper(btrim(p_country));
  v_age integer;
  v_min integer;
  v_profile public.profiles;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'profile_exists' using errcode = 'P0001';
  end if;
  if v_username !~ '^[a-z0-9._]{3,30}$' or v_username ~ '(^\.|\.$|\.\.)' then
    raise exception 'invalid_username' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.reserved_usernames r where r.username = v_username::extensions.citext
  ) then
    raise exception 'username_reserved' using errcode = 'P0001';
  end if;
  if v_country !~ '^[A-Z]{2}$' then
    raise exception 'invalid_country' using errcode = 'P0001';
  end if;
  if p_birth_date is null or p_birth_date > current_date or p_birth_date < date '1900-01-01' then
    raise exception 'invalid_birth_date' using errcode = 'P0001';
  end if;

  v_age := extract(year from age(current_date, p_birth_date))::integer;
  v_min := private.minimum_signup_age(v_country);
  if v_age < v_min then
    raise exception 'under_minimum_age' using errcode = 'P0001', detail = v_min::text;
  end if;

  insert into public.profiles (id, username, display_name, is_teen, is_private)
  values (
    v_uid, v_username::extensions.citext, nullif(btrim(p_display_name), ''),
    v_age < 18, v_age < 18
  )
  returning * into v_profile;

  insert into public.profile_private (user_id, birth_date, country)
  values (v_uid, p_birth_date, v_country);
  insert into public.profile_stats (user_id) values (v_uid);

  perform private.emit_event('profile.created', jsonb_build_object('user_id', v_uid));
  return v_profile;
exception
  when unique_violation then
    raise exception 'username_taken' using errcode = 'P0001';
end;
$$;
grant execute on function public.create_profile(text, date, text, text) to authenticated;

create or replace function public.follow_user(p_target uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_private boolean;
  v_state text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_target = v_uid then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
  if not private.is_action_allowed(v_uid, 'follow') then
    raise exception 'action_restricted' using errcode = 'P0001';
  end if;

  select p.is_private into v_private
  from public.profiles p
  where p.id = p_target and p.account_status in ('active', 'restricted');
  -- A blocked relationship looks exactly like a missing account.
  if not found or private.is_blocked_between(v_uid, p_target) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select f.state into v_state
  from public.follows f where f.follower_id = v_uid and f.followee_id = p_target;
  if found then
    return v_state;
  end if;

  v_state := case when v_private then 'pending' else 'active' end;
  insert into public.follows (follower_id, followee_id, state) values (v_uid, p_target, v_state);
  perform private.emit_event(
    'follow.' || v_state, jsonb_build_object('follower_id', v_uid, 'followee_id', p_target)
  );
  return v_state;
end;
$$;
grant execute on function public.follow_user(uuid) to authenticated;

create or replace function public.unfollow_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  delete from public.follows where follower_id = v_uid and followee_id = p_target;
  if found then
    perform private.emit_event(
      'follow.removed', jsonb_build_object('follower_id', v_uid, 'followee_id', p_target)
    );
  end if;
end;
$$;
grant execute on function public.unfollow_user(uuid) to authenticated;

create or replace function public.accept_follow_request(p_follower uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  update public.follows set state = 'active'
  where follower_id = p_follower and followee_id = v_uid and state = 'pending';
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform private.emit_event(
    'follow.accepted', jsonb_build_object('follower_id', p_follower, 'followee_id', v_uid)
  );
end;
$$;
grant execute on function public.accept_follow_request(uuid) to authenticated;

create or replace function public.reject_follow_request(p_follower uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  delete from public.follows
  where follower_id = p_follower and followee_id = v_uid and state = 'pending';
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;
grant execute on function public.reject_follow_request(uuid) to authenticated;

create or replace function public.remove_follower(p_follower uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  delete from public.follows where follower_id = p_follower and followee_id = v_uid;
  if found then
    perform private.emit_event(
      'follow.removed', jsonb_build_object('follower_id', p_follower, 'followee_id', v_uid)
    );
  end if;
end;
$$;
grant execute on function public.remove_follower(uuid) to authenticated;

create or replace function public.block_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_target = v_uid then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where id = p_target) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  insert into public.blocks (blocker_id, blocked_id) values (v_uid, p_target)
  on conflict do nothing;
  delete from public.follows
  where (follower_id = v_uid and followee_id = p_target)
     or (follower_id = p_target and followee_id = v_uid);
  perform private.emit_event(
    'block.created', jsonb_build_object('blocker_id', v_uid, 'blocked_id', p_target)
  );
end;
$$;
grant execute on function public.block_user(uuid) to authenticated;

create or replace function public.unblock_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  delete from public.blocks where blocker_id = v_uid and blocked_id = p_target;
end;
$$;
grant execute on function public.unblock_user(uuid) to authenticated;

create or replace function public.mute_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_target = v_uid then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
  if not private.is_profile_visible(p_target, v_uid) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  insert into public.mutes (muter_id, muted_id) values (v_uid, p_target) on conflict do nothing;
end;
$$;
grant execute on function public.mute_user(uuid) to authenticated;

create or replace function public.unmute_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  delete from public.mutes where muter_id = v_uid and muted_id = p_target;
end;
$$;
grant execute on function public.unmute_user(uuid) to authenticated;
