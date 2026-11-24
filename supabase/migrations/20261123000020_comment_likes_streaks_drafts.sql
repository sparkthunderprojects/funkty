-- Comment likes, posting streaks, drafts and scheduled posts.

create table public.comment_likes (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index comment_likes_user_idx on public.comment_likes (user_id);
alter table public.comment_likes enable row level security;
-- Visible to anyone who can see the comment (the comments policy applies inside this check).
create policy comment_likes_select on public.comment_likes for select to authenticated
  using (exists (select 1 from public.comments c where c.id = comment_id));
revoke all on public.comment_likes from anon, authenticated;
grant select on public.comment_likes to authenticated;

create function public.like_comment(p_comment_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (
    select 1 from public.comments c join public.posts p on p.id = c.post_id
    where c.id = p_comment_id and c.deleted_at is null and c.status = 'published' and p.deleted_at is null
      and private.can_view_post(p.author_id, p.visibility, v_uid)
      and not private.is_blocked_between(c.author_id, v_uid)
  ) then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not private.is_action_allowed(v_uid, 'like') then raise exception 'action_restricted' using errcode = 'P0001'; end if;
  insert into public.comment_likes (comment_id, user_id) values (p_comment_id, v_uid) on conflict do nothing;
end $$;

create function public.unlike_comment(p_comment_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  delete from public.comment_likes where comment_id = p_comment_id and user_id = auth.uid();
end $$;

-- Like counts for a page of comments. Runs as the caller, so the row policy decides what is counted.
create function public.comment_like_counts(p_ids uuid[])
returns table (comment_id uuid, like_count integer, liked boolean)
language sql stable security invoker set search_path = '' as $$
  select cl.comment_id, count(*)::integer, coalesce(bool_or(cl.user_id = auth.uid()), false)
  from public.comment_likes cl
  where cl.comment_id = any (p_ids)
  group by cl.comment_id;
$$;

-- Posting streak: consecutive days (UTC) with at least one post.
create function public.posting_streak()
returns table (current_streak integer, best_streak integer, posted_today boolean)
language sql stable security definer set search_path = '' as $$
  with d as (
    select distinct (created_at at time zone 'utc')::date as day
    from public.posts where author_id = auth.uid() and deleted_at is null
  ), g as (
    select day, day - (row_number() over (order by day))::integer as grp from d
  ), runs as (
    select max(day) as last_day, count(*)::integer as n from g group by grp
  )
  select
    coalesce((select n from runs where last_day >= (now() at time zone 'utc')::date - 1 order by last_day desc limit 1), 0),
    coalesce((select max(n) from runs), 0),
    exists (select 1 from d where day = (now() at time zone 'utc')::date);
$$;

-- Drafts and scheduled posts (photo posts: the photos are uploaded when the draft is saved).
create table public.post_drafts (
  id uuid primary key default private.uuidv7(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  caption text check (caption is null or char_length(caption) <= 2200),
  media_ids uuid[] not null check (array_length(media_ids, 1) between 1 and 10),
  alt_texts text[],
  is_spoiler boolean not null default false,
  scheduled_for timestamptz,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index post_drafts_owner_idx on public.post_drafts (owner_id, created_at desc);
create index post_drafts_due_idx on public.post_drafts (scheduled_for) where status = 'scheduled';
alter table public.post_drafts enable row level security;
create policy post_drafts_select_own on public.post_drafts for select to authenticated using (owner_id = (select auth.uid()));
revoke all on public.post_drafts from anon, authenticated;
grant select on public.post_drafts to authenticated;

create function public.save_draft(
  p_caption text, p_media_ids uuid[], p_alt_texts text[] default null, p_spoiler boolean default false, p_scheduled_for timestamptz default null
) returns public.post_drafts
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_count integer := coalesce(array_length(p_media_ids, 1), 0);
  v_ready integer;
  v_row public.post_drafts;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if v_count < 1 or v_count > 10 then raise exception 'invalid_media_count' using errcode = 'P0001'; end if;
  if char_length(coalesce(p_caption, '')) > 2200 then raise exception 'caption_too_long' using errcode = 'P0001'; end if;
  if p_scheduled_for is not null and (p_scheduled_for < now() + interval '30 seconds' or p_scheduled_for > now() + interval '30 days') then
    raise exception 'invalid_schedule' using errcode = 'P0001';
  end if;
  select count(*) into v_ready from public.media_assets m
    where m.id = any (p_media_ids) and m.owner_id = v_uid and m.status = 'ready' and m.kind = 'image'
      and not exists (select 1 from public.post_media pm where pm.media_id = m.id);
  if v_ready <> v_count then raise exception 'media_not_ready' using errcode = 'P0001'; end if;
  if (select count(*) from public.post_drafts where owner_id = v_uid) >= 50 then raise exception 'too_many_drafts' using errcode = 'P0001'; end if;
  insert into public.post_drafts (owner_id, caption, media_ids, alt_texts, is_spoiler, scheduled_for, status)
  values (v_uid, nullif(btrim(coalesce(p_caption, '')), ''), p_media_ids, p_alt_texts, coalesce(p_spoiler, false), p_scheduled_for,
          case when p_scheduled_for is null then 'draft' else 'scheduled' end)
  returning * into v_row;
  return v_row;
end $$;

create function public.update_draft(p_id uuid, p_caption text, p_scheduled_for timestamptz default null) returns public.post_drafts
language plpgsql security definer set search_path = '' as $$
declare v_row public.post_drafts;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if char_length(coalesce(p_caption, '')) > 2200 then raise exception 'caption_too_long' using errcode = 'P0001'; end if;
  if p_scheduled_for is not null and (p_scheduled_for < now() + interval '30 seconds' or p_scheduled_for > now() + interval '30 days') then
    raise exception 'invalid_schedule' using errcode = 'P0001';
  end if;
  update public.post_drafts
  set caption = nullif(btrim(coalesce(p_caption, '')), ''), scheduled_for = p_scheduled_for,
      status = case when p_scheduled_for is null then 'draft' else 'scheduled' end, error = null, updated_at = now()
  where id = p_id and owner_id = auth.uid() returning * into v_row;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  return v_row;
end $$;

create function public.delete_draft(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  delete from public.post_drafts where id = p_id and owner_id = auth.uid();
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
end $$;

create function public.publish_draft(p_id uuid) returns public.posts
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_d public.post_drafts;
  v_post public.posts;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into v_d from public.post_drafts where id = p_id and owner_id = v_uid for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_post := public.publish_post(coalesce(v_d.caption, ''), v_d.media_ids, 'public', v_d.alt_texts, true, v_d.is_spoiler);
  delete from public.post_drafts where id = p_id;
  return v_post;
end $$;

-- Runs every minute: posts every scheduled draft that is due. A failure marks that draft and moves on.
create function private.publish_due_drafts() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_d public.post_drafts;
  v_done integer := 0;
begin
  for v_d in
    select * from public.post_drafts where status = 'scheduled' and scheduled_for <= now()
    order by scheduled_for limit 50 for update skip locked
  loop
    begin
      perform set_config('request.jwt.claims', json_build_object('sub', v_d.owner_id, 'role', 'authenticated')::text, true);
      perform public.publish_post(coalesce(v_d.caption, ''), v_d.media_ids, 'public', v_d.alt_texts, true, v_d.is_spoiler);
      delete from public.post_drafts where id = v_d.id;
      v_done := v_done + 1;
    exception when others then
      update public.post_drafts set status = 'failed', error = left(sqlerrm, 200), updated_at = now() where id = v_d.id;
    end;
  end loop;
  perform set_config('request.jwt.claims', '', true);
  return v_done;
end $$;
revoke all on function private.publish_due_drafts() from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.schedule('publish-due-drafts', '* * * * *', 'select private.publish_due_drafts()');

revoke all on function public.like_comment(uuid), public.unlike_comment(uuid), public.comment_like_counts(uuid[]), public.posting_streak(),
  public.save_draft(text, uuid[], text[], boolean, timestamptz), public.update_draft(uuid, text, timestamptz),
  public.delete_draft(uuid), public.publish_draft(uuid) from public, anon;
grant execute on function public.like_comment(uuid), public.unlike_comment(uuid), public.comment_like_counts(uuid[]), public.posting_streak(),
  public.save_draft(text, uuid[], text[], boolean, timestamptz), public.update_draft(uuid, text, timestamptz),
  public.delete_draft(uuid), public.publish_draft(uuid) to authenticated;
