-- Spoiler veil: an author can mark a post as a spoiler; clients show it blurred until tapped.
-- publish_post and edit_post gain a parameter, so the old signatures are dropped first
-- (two overloads would make the RPC call ambiguous).

alter table public.posts add column is_spoiler boolean not null default false;

drop function public.publish_post(text, uuid[], text, text[], boolean);
drop function public.edit_post(uuid, text, boolean);

create or replace function public.publish_post(
  p_caption text,
  p_media_ids uuid[],
  p_visibility text default 'public',
  p_alt_texts text[] default null,
  p_comments_enabled boolean default true,
  p_is_spoiler boolean default false
)
returns public.posts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
  v_ready integer;
  v_videos integer;
  v_kind text;
  v_post public.posts;
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
  if p_visibility not in ('public', 'followers', 'private') then
    raise exception 'invalid_visibility' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_caption, '')) > 2200 then
    raise exception 'caption_too_long' using errcode = 'P0001';
  end if;

  v_count := coalesce(array_length(p_media_ids, 1), 0);
  if v_count < 1 or v_count > 10 then
    raise exception 'invalid_media_count' using errcode = 'P0001';
  end if;
  if (select count(distinct m) from unnest(p_media_ids) as m) <> v_count then
    raise exception 'duplicate_media' using errcode = 'P0001';
  end if;

  select count(*), count(*) filter (where m.kind = 'video')
  into v_ready, v_videos
  from public.media_assets m
  where m.id = any (p_media_ids)
    and m.owner_id = v_uid
    and m.status = 'ready'
    and not exists (select 1 from public.post_media pm where pm.media_id = m.id);
  if v_ready <> v_count then
    raise exception 'media_not_ready' using errcode = 'P0001';
  end if;
  if v_videos > 0 and v_count > 1 then
    raise exception 'video_must_be_single' using errcode = 'P0001';
  end if;

  v_kind := case when v_videos = 1 then 'video' when v_count = 1 then 'photo' else 'carousel' end;

  insert into public.posts (author_id, kind, caption, visibility, status, comments_enabled, is_spoiler)
  values (
    v_uid, v_kind, nullif(btrim(coalesce(p_caption, '')), ''), p_visibility, 'published',
    coalesce(p_comments_enabled, true), coalesce(p_is_spoiler, false)
  )
  returning * into v_post;

  insert into public.post_media (post_id, position, media_id, alt_text)
  select v_post.id, (o.ord - 1)::smallint, o.media_id, nullif(btrim(p_alt_texts[o.ord::integer]), '')
  from unnest(p_media_ids) with ordinality as o (media_id, ord);

  insert into public.post_stats (post_id) values (v_post.id);
  update public.profile_stats set posts_count = posts_count + 1 where user_id = v_uid;

  perform private.emit_event(
    'post.published',
    jsonb_build_object('post_id', v_post.id, 'author_id', v_uid, 'visibility', p_visibility)
  );
  return v_post;
end;
$$;

revoke execute on function public.publish_post(text, uuid[], text, text[], boolean, boolean) from public, anon;
grant execute on function public.publish_post(text, uuid[], text, text[], boolean, boolean) to authenticated;

create or replace function public.edit_post(
  p_post_id uuid,
  p_caption text,
  p_comments_enabled boolean default null,
  p_is_spoiler boolean default null
)
returns public.posts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_post public.posts;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if char_length(coalesce(p_caption, '')) > 2200 then
    raise exception 'caption_too_long' using errcode = 'P0001';
  end if;
  update public.posts
  set caption = nullif(btrim(coalesce(p_caption, '')), ''),
      comments_enabled = coalesce(p_comments_enabled, comments_enabled),
      is_spoiler = coalesce(p_is_spoiler, is_spoiler),
      edited_at = now()
  where id = p_post_id and author_id = v_uid and deleted_at is null
  returning * into v_post;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform private.emit_event('post.edited', jsonb_build_object('post_id', p_post_id));
  return v_post;
end;
$$;

revoke execute on function public.edit_post(uuid, text, boolean, boolean) from public, anon;
grant execute on function public.edit_post(uuid, text, boolean, boolean) to authenticated;
