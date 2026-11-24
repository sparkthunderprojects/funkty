-- Shared collections: the owner invites mutual followers, who can add posts and remove their own.
-- Reading a shared collection never widens post visibility: posts are still read through posts RLS.

create table public.collection_members (
  collection_id uuid not null references public.collections (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'active')),
  invited_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (collection_id, user_id)
);
create index collection_members_user_idx on public.collection_members (user_id, status);
alter table public.collection_members enable row level security;

-- SECURITY DEFINER so policies on collections and members can ask without recursing through RLS.
create function private.is_collection_member(p_collection uuid, p_uid uuid, p_active_only boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.collections c where c.id = p_collection and c.user_id = p_uid
  ) or exists (
    select 1 from public.collection_members m
    where m.collection_id = p_collection and m.user_id = p_uid and (not p_active_only or m.status = 'active')
  );
$$;

create policy collection_members_select on public.collection_members for select to authenticated
  using (user_id = (select auth.uid()) or private.is_collection_member(collection_id, (select auth.uid()), true));
grant select on public.collection_members to authenticated;

alter policy collections_select_own on public.collections
  using (user_id = (select auth.uid()) or private.is_collection_member(id, (select auth.uid()), false));
alter policy collection_posts_select_own on public.collection_posts
  using (user_id = (select auth.uid()) or private.is_collection_member(collection_id, (select auth.uid()), true));

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array['like', 'comment', 'follow', 'follow_request', 'tag_request', 'repost', 'comment_like', 'story_reply', 'comment_held', 'collection_invite']));

create function public.invite_to_collection(p_collection_id uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.collections c where c.id = p_collection_id and c.user_id = v_uid) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_user = v_uid or private.is_blocked_between(v_uid, p_user) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not (
    exists (select 1 from public.follows f where f.follower_id = v_uid and f.followee_id = p_user and f.state = 'active')
    and exists (select 1 from public.follows f where f.follower_id = p_user and f.followee_id = v_uid and f.state = 'active')
  ) then
    raise exception 'not_mutual' using errcode = 'P0001';
  end if;
  if (select count(*) from public.collection_members where collection_id = p_collection_id) >= 10 then
    raise exception 'too_many_members' using errcode = 'P0001';
  end if;
  insert into public.collection_members (collection_id, user_id, invited_by) values (p_collection_id, p_user, v_uid)
    on conflict do nothing;
  if found then
    insert into public.notifications (user_id, actor_id, type) values (p_user, v_uid, 'collection_invite');
  end if;
end $$;

create function public.respond_collection_invite(p_collection_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_accept then
    update public.collection_members set status = 'active'
    where collection_id = p_collection_id and user_id = v_uid and status = 'invited';
    if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  else
    delete from public.collection_members where collection_id = p_collection_id and user_id = v_uid and status = 'invited';
  end if;
end $$;

-- The owner removes anyone; anyone else can only remove themselves (leave).
-- Posts a member added stay in the collection; the owner can remove them.
create function public.remove_collection_member(p_collection_id uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_user <> v_uid and not exists (select 1 from public.collections c where c.id = p_collection_id and c.user_id = v_uid) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  delete from public.collection_members where collection_id = p_collection_id and user_id = p_user;
end $$;

-- Owners and active members add posts; members remove only what they added, the owner removes anything.
create or replace function public.set_collection_post(p_collection_id uuid, p_post_id uuid, p_in boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_owner boolean;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not private.is_collection_member(p_collection_id, v_uid, true) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select exists (select 1 from public.collections c where c.id = p_collection_id and c.user_id = v_uid) into v_owner;
  if p_in then
    if not exists (
      select 1 from public.posts p
      where p.id = p_post_id and p.deleted_at is null and private.can_view_post(p.author_id, p.visibility, v_uid)
    ) then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    if (select count(*) from public.collection_posts where collection_id = p_collection_id) >= 500 then
      raise exception 'collection_full' using errcode = 'P0001';
    end if;
    insert into public.saves (post_id, user_id) values (p_post_id, v_uid) on conflict do nothing;
    insert into public.collection_posts (collection_id, post_id, user_id) values (p_collection_id, p_post_id, v_uid)
      on conflict do nothing;
  else
    delete from public.collection_posts
    where collection_id = p_collection_id and post_id = p_post_id and (v_owner or user_id = v_uid);
  end if;
end $$;

revoke all on function public.invite_to_collection(uuid, uuid), public.respond_collection_invite(uuid, boolean), public.remove_collection_member(uuid, uuid) from public, anon;
grant execute on function public.invite_to_collection(uuid, uuid), public.respond_collection_invite(uuid, boolean), public.remove_collection_member(uuid, uuid) to authenticated;
revoke all on function private.is_collection_member(uuid, uuid, boolean) from public, anon;
grant execute on function private.is_collection_member(uuid, uuid, boolean) to authenticated;
