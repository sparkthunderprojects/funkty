-- Pin up to 3 posts to the profile, archive posts (hidden from everyone but the author)
-- and hide the like count on a post. (remove_follower already exists from an earlier migration.)

alter table public.posts
  add column pinned_at timestamptz,
  add column archived_at timestamptz,
  add column hide_like_count boolean not null default false;

create index posts_author_pinned_idx on public.posts (author_id, pinned_at desc) where pinned_at is not null;
create index posts_author_archived_idx on public.posts (author_id, archived_at desc) where archived_at is not null;

grant select (pinned_at, archived_at, hide_like_count) on public.posts to authenticated;

-- Archived posts stay visible to their author only.
alter policy posts_select on public.posts using (
  deleted_at is null
  and (
    author_id = (select auth.uid())
    or (
      archived_at is null
      and status = any (array['published', 'restricted'])
      and private.can_view_post(author_id, visibility, (select auth.uid()))
    )
  )
);

create function public.set_post_pinned(p_post_id uuid, p_on boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.posts where id = p_post_id and author_id = v_uid and deleted_at is null and archived_at is null) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_on then
    if (select count(*) from public.posts where author_id = v_uid and pinned_at is not null and deleted_at is null and id <> p_post_id) >= 3 then
      raise exception 'too_many_pins' using errcode = 'P0001';
    end if;
    update public.posts set pinned_at = now() where id = p_post_id and author_id = v_uid;
  else
    update public.posts set pinned_at = null where id = p_post_id and author_id = v_uid;
  end if;
end $$;

create function public.set_post_archived(p_post_id uuid, p_on boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  update public.posts
  set archived_at = case when p_on then now() else null end,
      pinned_at = case when p_on then null else pinned_at end
  where id = p_post_id and author_id = v_uid and deleted_at is null;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
end $$;

create function public.set_post_hide_likes(p_post_id uuid, p_on boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  update public.posts set hide_like_count = p_on where id = p_post_id and author_id = v_uid and deleted_at is null;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'set_post_pinned(uuid,boolean)', 'set_post_archived(uuid,boolean)',
    'set_post_hide_likes(uuid,boolean)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
