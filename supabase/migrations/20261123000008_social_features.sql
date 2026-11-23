-- Notifications, stories and direct messages.
-- Same model as content: clients read through RLS, every write goes through an RPC or a
-- trigger that validates ownership, visibility and account restrictions.

-- ---------------------------------------------------------------------------
-- Notifications (written only by triggers)
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default private.uuidv7(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('like', 'comment', 'follow', 'follow_request')),
  post_id uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_user_idx on public.notifications (user_id, id desc);
create index notifications_actor_idx on public.notifications (actor_id);
create index notifications_post_idx on public.notifications (post_id) where post_id is not null;
create index notifications_comment_idx on public.notifications (comment_id) where comment_id is not null;

alter table public.notifications enable row level security;
create policy notifications_select_own on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.notifications to authenticated;

create or replace function private.notify_like()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_author uuid;
begin
  select p.author_id into v_author from public.posts p where p.id = new.post_id;
  if v_author is not null and v_author <> new.user_id
     and not private.is_blocked_between(v_author, new.user_id) then
    insert into public.notifications (user_id, actor_id, type, post_id)
    values (v_author, new.user_id, 'like', new.post_id);
  end if;
  return new;
end $$;
create trigger likes_notify after insert on public.likes
  for each row execute function private.notify_like();

create or replace function private.unnotify_like()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.notifications
  where type = 'like' and actor_id = old.user_id and post_id = old.post_id;
  return old;
end $$;
create trigger likes_unnotify after delete on public.likes
  for each row execute function private.unnotify_like();

create or replace function private.notify_comment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_author uuid;
begin
  select p.author_id into v_author from public.posts p where p.id = new.post_id;
  if v_author is not null and v_author <> new.author_id
     and not private.is_blocked_between(v_author, new.author_id) then
    insert into public.notifications (user_id, actor_id, type, post_id, comment_id)
    values (v_author, new.author_id, 'comment', new.post_id, new.id);
  end if;
  return new;
end $$;
create trigger comments_notify after insert on public.comments
  for each row execute function private.notify_comment();

create or replace function private.notify_follow()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, actor_id, type)
    values (new.followee_id, new.follower_id,
            case when new.state = 'active' then 'follow' else 'follow_request' end);
  elsif tg_op = 'UPDATE' and old.state = 'pending' and new.state = 'active' then
    update public.notifications set type = 'follow'
    where type = 'follow_request' and user_id = new.followee_id and actor_id = new.follower_id;
  end if;
  return new;
end $$;
create trigger follows_notify after insert or update of state on public.follows
  for each row execute function private.notify_follow();

create or replace function private.unnotify_follow()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.notifications
  where type in ('follow', 'follow_request')
    and user_id = old.followee_id and actor_id = old.follower_id;
  return old;
end $$;
create trigger follows_unnotify after delete on public.follows
  for each row execute function private.unnotify_follow();

create or replace function public.mark_notifications_read()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null;
end $$;

-- ---------------------------------------------------------------------------
-- Stories (24 hours)
-- ---------------------------------------------------------------------------

create table public.stories (
  id uuid primary key default private.uuidv7(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  media_id uuid not null unique references public.media_assets (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  deleted_at timestamptz
);
create index stories_author_idx on public.stories (author_id, id desc) where deleted_at is null;
create index stories_expires_idx on public.stories (expires_at) where deleted_at is null;

create table public.story_views (
  story_id uuid not null references public.stories (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);
create index story_views_viewer_idx on public.story_views (viewer_id);

alter table public.stories enable row level security;
alter table public.story_views enable row level security;

create policy stories_select on public.stories for select to authenticated
  using (
    deleted_at is null
    and (
      author_id = (select auth.uid())
      or (expires_at > now() and private.can_view_author(author_id, (select auth.uid())))
    )
  );
create policy story_views_select on public.story_views for select to authenticated
  using (
    viewer_id = (select auth.uid())
    or exists (
      select 1 from public.stories s
      where s.id = story_views.story_id and s.author_id = (select auth.uid())
    )
  );
grant select on public.stories, public.story_views to authenticated;

-- Story photos must be readable by whoever can see the story.
alter policy media_assets_select on public.media_assets
  using (
    owner_id = (select auth.uid())
    or (
      status = 'ready'
      and (
        exists (select 1 from public.post_media pm where pm.media_id = media_assets.id)
        or exists (select 1 from public.profiles pr where pr.avatar_media_id = media_assets.id)
        or exists (select 1 from public.stories s where s.media_id = media_assets.id)
      )
    )
  );

create or replace function public.publish_story(p_media_id uuid)
returns public.stories
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_story public.stories;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_action_allowed(v_uid, 'post') then
    raise exception 'action_restricted' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from auth.users u where u.id = v_uid and u.email_confirmed_at is not null
  ) then
    raise exception 'email_not_verified' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.media_assets m
    where m.id = p_media_id and m.owner_id = v_uid and m.status = 'ready' and m.kind = 'image'
      and not exists (select 1 from public.post_media pm where pm.media_id = m.id)
      and not exists (select 1 from public.stories s where s.media_id = m.id)
  ) then
    raise exception 'media_not_ready' using errcode = 'P0001';
  end if;
  insert into public.stories (author_id, media_id) values (v_uid, p_media_id)
  returning * into v_story;
  return v_story;
end $$;

create or replace function public.view_story(p_story_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.stories s
    where s.id = p_story_id and s.deleted_at is null and s.expires_at > now()
      and private.can_view_author(s.author_id, v_uid)
  ) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  insert into public.story_views (story_id, viewer_id) values (p_story_id, v_uid)
  on conflict do nothing;
end $$;

create or replace function public.delete_story(p_story_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  update public.stories set deleted_at = now()
  where id = p_story_id and author_id = auth.uid() and deleted_at is null;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Direct messages (one to one)
-- ---------------------------------------------------------------------------

create table public.messages (
  id uuid primary key default private.uuidv7(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id)
);
create index messages_thread_idx on public.messages (recipient_id, sender_id, id desc);
create index messages_sender_idx on public.messages (sender_id, recipient_id, id desc);

alter table public.messages enable row level security;
create policy messages_select_participant on public.messages for select to authenticated
  using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));
grant select on public.messages to authenticated;

create or replace function public.send_message(p_recipient uuid, p_body text)
returns public.messages
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_body text := btrim(coalesce(p_body, ''));
  v_msg public.messages;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_uid = p_recipient then
    raise exception 'invalid_recipient' using errcode = 'P0001';
  end if;
  if char_length(v_body) not between 1 and 2000 then
    raise exception 'invalid_body' using errcode = 'P0001';
  end if;
  if not private.is_action_allowed(v_uid, 'message') then
    raise exception 'action_restricted' using errcode = 'P0001';
  end if;
  if not private.is_profile_visible(p_recipient, v_uid) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if (
    select count(*) from public.messages m
    where m.sender_id = v_uid and m.created_at > now() - interval '1 minute'
  ) >= 30 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.messages (sender_id, recipient_id, body)
  values (v_uid, p_recipient, v_body)
  returning * into v_msg;
  return v_msg;
end $$;

create or replace function public.mark_thread_read(p_other uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  update public.messages set read_at = now()
  where recipient_id = auth.uid() and sender_id = p_other and read_at is null;
end $$;

-- One row per conversation, most recent first.
create or replace function public.inbox()
returns table (
  other_id uuid,
  username text,
  last_body text,
  last_at timestamptz,
  last_sender uuid,
  unread bigint
)
language sql stable security definer set search_path = '' as $$
  with mine as (
    select m.*, case when m.sender_id = auth.uid() then m.recipient_id else m.sender_id end as other
    from public.messages m
    where m.sender_id = auth.uid() or m.recipient_id = auth.uid()
  ), latest as (
    select distinct on (other) other, body, created_at, sender_id
    from mine order by other, id desc
  )
  select l.other, p.username::text, l.body, l.created_at, l.sender_id,
         (select count(*) from mine x
          where x.other = l.other and x.recipient_id = auth.uid() and x.read_at is null)
  from latest l
  join public.profiles p on p.id = l.other
  where auth.uid() is not null and not private.is_blocked_between(l.other, auth.uid())
  order by l.created_at desc;
$$;

-- ---------------------------------------------------------------------------
-- Privileges: signed-in users only
-- ---------------------------------------------------------------------------

revoke execute on function
  public.mark_notifications_read(),
  public.publish_story(uuid),
  public.view_story(uuid),
  public.delete_story(uuid),
  public.send_message(uuid, text),
  public.mark_thread_read(uuid),
  public.inbox()
from public, anon;
grant execute on function
  public.mark_notifications_read(),
  public.publish_story(uuid),
  public.view_story(uuid),
  public.delete_story(uuid),
  public.send_message(uuid, text),
  public.mark_thread_read(uuid),
  public.inbox()
to authenticated;
