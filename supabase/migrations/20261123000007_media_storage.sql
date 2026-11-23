-- Photo storage on Supabase Storage (v0). Moves to R2 behind the same storage_key contract
-- later (see ADR). Clients upload to their own folder only; media_assets rows are created by
-- register_image, which verifies the object exists and checks type and size.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Anyone can read published media by URL (the bucket is public); listing is not granted.
-- Authenticated users may add objects only under their own user-id folder.
create policy media_objects_insert_own on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy media_objects_delete_own on storage.objects for delete to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create or replace function public.register_image(
  p_storage_key text,
  p_mime_type text,
  p_bytes bigint,
  p_width integer default null,
  p_height integer default null
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
  if p_mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'invalid_mime_type' using errcode = 'P0001';
  end if;
  if p_bytes is null or p_bytes < 1 or p_bytes > 10485760 then
    raise exception 'invalid_size' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from storage.objects o where o.bucket_id = 'media' and o.name = p_storage_key
  ) then
    raise exception 'object_missing' using errcode = 'P0001';
  end if;

  -- Rate limit: at most 50 registrations per user per hour.
  if (
    select count(*) from public.media_assets m
    where m.owner_id = v_uid and m.created_at > now() - interval '1 hour'
  ) >= 50 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  -- Status is 'ready' immediately: there is no scanning pipeline yet. Image scanning and
  -- re-encoding (strip EXIF, resize) is a launch blocker tracked in docs/adr.
  insert into public.media_assets (owner_id, kind, status, storage_key, mime_type, bytes, width, height)
  values (v_uid, 'image', 'ready', p_storage_key, p_mime_type, p_bytes,
          nullif(p_width, 0), nullif(p_height, 0))
  returning * into v_asset;
  return v_asset;
end;
$$;
grant execute on function public.register_image(text, text, bigint, integer, integer) to authenticated;
revoke execute on function public.register_image(text, text, bigint, integer, integer) from public, anon;
