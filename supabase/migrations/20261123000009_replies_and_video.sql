-- Comment replies and video uploads.
-- Replies: the comments table and add_comment already support one level of parent_id. This
-- migration makes a reply notify the person being replied to, as well as the post author.
-- Video: the media bucket accepts video, and register_video verifies a video the same way
-- register_image verifies a photo. Video is NOT scanned or transcoded yet (launch blocker,
-- see docs/adr): clients upload an MP4/MOV/WebM as-is and a poster frame as a JPEG.

create or replace function private.notify_comment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_author uuid;
  v_parent_author uuid;
begin
  select p.author_id into v_author from public.posts p where p.id = new.post_id;
  if v_author is not null and v_author <> new.author_id
     and not private.is_blocked_between(v_author, new.author_id) then
    insert into public.notifications (user_id, actor_id, type, post_id, comment_id)
    values (v_author, new.author_id, 'comment', new.post_id, new.id);
  end if;
  if new.parent_id is not null then
    select c.author_id into v_parent_author from public.comments c where c.id = new.parent_id;
    if v_parent_author is not null
       and v_parent_author <> new.author_id
       and v_parent_author is distinct from v_author
       and not private.is_blocked_between(v_parent_author, new.author_id) then
      insert into public.notifications (user_id, actor_id, type, post_id, comment_id)
      values (v_parent_author, new.author_id, 'comment', new.post_id, new.id);
    end if;
  end if;
  return new;
end $$;

-- Supabase Storage free-tier objects are capped at 50 MB, so that is the limit here.
update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']
where id = 'media';

create or replace function public.register_video(
  p_storage_key text,
  p_mime_type text,
  p_bytes bigint,
  p_duration_ms integer,
  p_width integer default null,
  p_height integer default null,
  p_poster_key text default null
)
returns public.media_assets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_asset public.media_assets;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_action_allowed(v_uid, 'post') then
    raise exception 'action_restricted' using errcode = 'P0001';
  end if;
  if p_storage_key is null or p_storage_key not like v_uid::text || '/%' or p_storage_key like '%..%' then
    raise exception 'invalid_storage_key' using errcode = 'P0001';
  end if;
  if p_poster_key is not null
     and (p_poster_key not like v_uid::text || '/%' or p_poster_key like '%..%') then
    raise exception 'invalid_storage_key' using errcode = 'P0001';
  end if;
  if p_mime_type not in ('video/mp4', 'video/quicktime', 'video/webm') then
    raise exception 'invalid_mime_type' using errcode = 'P0001';
  end if;
  if p_bytes is null or p_bytes < 1 or p_bytes > 52428800 then
    raise exception 'invalid_size' using errcode = 'P0001';
  end if;
  if p_duration_ms is null or p_duration_ms < 500 or p_duration_ms > 90000 then
    raise exception 'invalid_duration' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from storage.objects o where o.bucket_id = 'media' and o.name = p_storage_key
  ) then
    raise exception 'object_missing' using errcode = 'P0001';
  end if;
  if p_poster_key is not null and not exists (
    select 1 from storage.objects o where o.bucket_id = 'media' and o.name = p_poster_key
  ) then
    raise exception 'object_missing' using errcode = 'P0001';
  end if;

  -- Rate limit: at most 10 videos per user per hour.
  if (
    select count(*) from public.media_assets m
    where m.owner_id = v_uid and m.kind = 'video' and m.created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.media_assets
    (owner_id, kind, status, storage_key, mime_type, bytes, width, height, duration_ms, variants)
  values (v_uid, 'video', 'ready', p_storage_key, p_mime_type, p_bytes,
          nullif(p_width, 0), nullif(p_height, 0), p_duration_ms,
          case when p_poster_key is null then '{}'::jsonb else jsonb_build_object('poster', p_poster_key) end)
  returning * into v_asset;
  return v_asset;
end;
$$;
grant execute on function public.register_video(text, text, bigint, integer, integer, integer, text) to authenticated;
revoke execute on function public.register_video(text, text, bigint, integer, integer, integer, text) from public, anon;
