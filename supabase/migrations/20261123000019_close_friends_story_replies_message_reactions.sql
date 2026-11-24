-- Close friends stories, story replies, message reactions and unsend.

create table public.close_friends (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, friend_id),
  check (owner_id <> friend_id)
);
create index close_friends_friend_idx on public.close_friends (friend_id);
alter table public.close_friends enable row level security;
-- Only the owner can read the list, so nobody learns they are on someone else's list.
create policy close_friends_select_own on public.close_friends for select to authenticated using (owner_id = (select auth.uid()));
revoke all on public.close_friends from anon, authenticated;
grant select on public.close_friends to authenticated;

create or replace function private.is_close_friend(p_owner uuid, p_viewer uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.close_friends c where c.owner_id = p_owner and c.friend_id = p_viewer);
$$;
grant execute on function private.is_close_friend(uuid, uuid) to anon, authenticated, service_role;

alter table public.stories add column audience text not null default 'everyone' check (audience in ('everyone', 'close_friends'));

alter policy stories_select on public.stories using (
  deleted_at is null
  and (
    author_id = (select auth.uid())
    or (
      expires_at > now()
      and private.can_view_author(author_id, (select auth.uid()))
      and (audience = 'everyone' or private.is_close_friend(author_id, (select auth.uid())))
    )
  )
);

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
      and (s.audience = 'everyone' or private.is_close_friend(s.author_id, v_uid))
  ) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  insert into public.story_views (story_id, viewer_id) values (p_story_id, v_uid)
  on conflict do nothing;
end $$;

create function public.set_close_friend(p_friend uuid, p_in boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_friend = v_uid then raise exception 'invalid_target' using errcode = 'P0001'; end if;
  if p_in then
    if not private.is_profile_visible(p_friend, v_uid) or private.is_blocked_between(p_friend, v_uid) then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    if (select count(*) from public.close_friends where owner_id = v_uid) >= 500 then
      raise exception 'too_many_close_friends' using errcode = 'P0001';
    end if;
    insert into public.close_friends (owner_id, friend_id) values (v_uid, p_friend) on conflict do nothing;
  else
    delete from public.close_friends where owner_id = v_uid and friend_id = p_friend;
  end if;
end $$;

create function public.set_story_audience(p_story_id uuid, p_audience text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_audience not in ('everyone', 'close_friends') then raise exception 'invalid_audience' using errcode = 'P0001'; end if;
  update public.stories set audience = p_audience where id = p_story_id and author_id = auth.uid() and deleted_at is null;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
end $$;

-- Messages: story context, unsend, reactions.
alter table public.messages add column story_id uuid references public.stories (id) on delete set null;
alter table public.messages add column unsent_at timestamptz;

create function public.reply_to_story(p_story_id uuid, p_body text) returns public.messages
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_author uuid;
  v_msg public.messages;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select s.author_id into v_author from public.stories s
    where s.id = p_story_id and s.deleted_at is null and s.expires_at > now()
      and private.can_view_author(s.author_id, v_uid)
      and (s.audience = 'everyone' or private.is_close_friend(s.author_id, v_uid));
  if v_author is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_msg := public.send_message(v_author, p_body);
  update public.messages set story_id = p_story_id where id = v_msg.id returning * into v_msg;
  return v_msg;
end $$;

create table public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (emoji in ('❤️', '😂', '😮', '😢', '🔥', '👍')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
alter table public.message_reactions enable row level security;
create policy message_reactions_select on public.message_reactions for select to authenticated
  using (exists (select 1 from public.messages m where m.id = message_id));
revoke all on public.message_reactions from anon, authenticated;
grant select on public.message_reactions to authenticated;

create function public.react_message(p_message uuid, p_emoji text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (
    select 1 from public.messages m
    where m.id = p_message and m.unsent_at is null and (m.sender_id = v_uid or m.recipient_id = v_uid)
  ) then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_emoji is null then
    delete from public.message_reactions where message_id = p_message and user_id = v_uid;
  else
    insert into public.message_reactions (message_id, user_id, emoji) values (p_message, v_uid, p_emoji)
    on conflict (message_id, user_id) do update set emoji = excluded.emoji, created_at = now();
  end if;
end $$;

create function public.unsend_message(p_message uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  update public.messages set unsent_at = now(), body = 'Message unsent', story_id = null
  where id = p_message and sender_id = auth.uid() and unsent_at is null;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  delete from public.message_reactions where message_id = p_message;
end $$;

revoke all on function public.set_close_friend(uuid, boolean), public.set_story_audience(uuid, text),
  public.reply_to_story(uuid, text), public.react_message(uuid, text), public.unsend_message(uuid) from public, anon;
grant execute on function public.set_close_friend(uuid, boolean), public.set_story_audience(uuid, text),
  public.reply_to_story(uuid, text), public.react_message(uuid, text), public.unsend_message(uuid) to authenticated;
