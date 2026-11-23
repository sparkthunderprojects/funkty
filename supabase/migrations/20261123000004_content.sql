-- Content: media assets, posts, comments, likes, saves.
-- Clients read through RLS; every write goes through an RPC function that validates
-- ownership, visibility, account restrictions and verified email, and records an outbox
-- event in the same transaction.

create table public.media_assets (
  id uuid primary key default private.uuidv7(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('image', 'video')),
  status text not null default 'uploading'
    check (status in ('uploading', 'scanning', 'processing', 'ready', 'failed', 'blocked')),
  storage_key text not null unique,
  mime_type text not null,
  bytes bigint check (bytes is null or bytes > 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  duration_ms integer check (duration_ms is null or duration_ms > 0),
  placeholder text,
  variants jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index media_assets_owner_idx on public.media_assets (owner_id, created_at desc);
create trigger media_assets_set_updated_at before update on public.media_assets
  for each row execute function private.set_updated_at();

alter table public.profiles
  add constraint profiles_avatar_media_fk
  foreign key (avatar_media_id) references public.media_assets (id) on delete set null;

-- A profile may only use its own, finished media as an avatar.
create or replace function private.profiles_avatar_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.avatar_media_id is not null and not exists (
    select 1 from public.media_assets m
    where m.id = new.avatar_media_id and m.owner_id = new.id
      and m.kind = 'image' and m.status = 'ready'
  ) then
    raise exception 'invalid_avatar' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger profiles_avatar_guard before insert or update of avatar_media_id on public.profiles
  for each row execute function private.profiles_avatar_guard();

create table public.posts (
  id uuid primary key default private.uuidv7(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('photo', 'video', 'carousel', 'text')),
  caption text check (char_length(caption) <= 2200),
  visibility text not null default 'public' check (visibility in ('public', 'followers', 'private')),
  status text not null default 'processing'
    check (status in ('processing', 'published', 'restricted', 'removed')),
  comments_enabled boolean not null default true,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index posts_author_idx on public.posts (author_id, id desc) where deleted_at is null;
create trigger posts_set_updated_at before update on public.posts
  for each row execute function private.set_updated_at();

create table public.post_media (
  post_id uuid not null references public.posts (id) on delete cascade,
  position smallint not null check (position >= 0 and position < 10),
  media_id uuid not null unique references public.media_assets (id),
  alt_text text check (char_length(alt_text) <= 1000),
  primary key (post_id, position)
);

create table public.post_stats (
  post_id uuid primary key references public.posts (id) on delete cascade,
  like_count integer not null default 0 check (like_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  save_count integer not null default 0 check (save_count >= 0)
);

create table public.comments (
  id uuid primary key default private.uuidv7(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2200),
  status text not null default 'published' check (status in ('published', 'restricted', 'removed')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index comments_post_idx on public.comments (post_id, id) where deleted_at is null;
create index comments_parent_idx on public.comments (parent_id) where parent_id is not null;
create index comments_author_idx on public.comments (author_id, created_at desc);

create table public.likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index likes_user_idx on public.likes (user_id, created_at desc);

create table public.saves (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index saves_user_idx on public.saves (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Visibility of a post to a viewer. Callers also check deleted_at and status.
create or replace function private.can_view_post(p_author uuid, p_visibility text, viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p_author = viewer, false)
    or (
      private.can_view_author(p_author, viewer)
      and (
        p_visibility = 'public'
        or (
          p_visibility = 'followers'
          and exists (
            select 1 from public.follows f
            where f.follower_id = viewer and f.followee_id = p_author and f.state = 'active'
          )
        )
      )
    );
$$;
grant execute on function private.can_view_post(uuid, text, uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security and privileges
-- ---------------------------------------------------------------------------

alter table public.media_assets enable row level security;
alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.post_stats enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.saves enable row level security;

create policy posts_select on public.posts for select to anon, authenticated
  using (
    deleted_at is null
    and (
      author_id = (select auth.uid())
      or (
        status in ('published', 'restricted')
        and private.can_view_post(author_id, visibility, (select auth.uid()))
      )
    )
  );

-- Rows of post_media and post_stats are visible exactly when their post is (the posts policy
-- applies inside these subqueries).
create policy post_media_select on public.post_media for select to anon, authenticated
  using (exists (select 1 from public.posts p where p.id = post_media.post_id));
create policy post_stats_select on public.post_stats for select to anon, authenticated
  using (exists (select 1 from public.posts p where p.id = post_stats.post_id));

create policy media_assets_select on public.media_assets for select to anon, authenticated
  using (
    owner_id = (select auth.uid())
    or (
      status = 'ready'
      and (
        exists (select 1 from public.post_media pm where pm.media_id = media_assets.id)
        or exists (select 1 from public.profiles pr where pr.avatar_media_id = media_assets.id)
      )
    )
  );

create policy comments_select on public.comments for select to anon, authenticated
  using (
    deleted_at is null
    and status = 'published'
    and exists (select 1 from public.posts p where p.id = comments.post_id)
    and (
      author_id = (select auth.uid())
      or not private.is_blocked_between(author_id, (select auth.uid()))
    )
  );

create policy likes_select_own on public.likes for select to authenticated
  using (user_id = (select auth.uid()));
create policy saves_select_own on public.saves for select to authenticated
  using (user_id = (select auth.uid()));

grant select on public.media_assets, public.posts, public.post_media, public.post_stats,
  public.comments to anon, authenticated;
grant select on public.likes, public.saves to authenticated;

-- ---------------------------------------------------------------------------
-- RPC functions
-- ---------------------------------------------------------------------------

create or replace function public.publish_post(
  p_caption text,
  p_media_ids uuid[],
  p_visibility text default 'public',
  p_alt_texts text[] default null,
  p_comments_enabled boolean default true
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

  insert into public.posts (author_id, kind, caption, visibility, status, comments_enabled)
  values (
    v_uid, v_kind, nullif(btrim(coalesce(p_caption, '')), ''), p_visibility, 'published',
    coalesce(p_comments_enabled, true)
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
grant execute on function public.publish_post(text, uuid[], text, text[], boolean) to authenticated;

create or replace function public.edit_post(
  p_post_id uuid,
  p_caption text,
  p_comments_enabled boolean default null
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
grant execute on function public.edit_post(uuid, text, boolean) to authenticated;

create or replace function public.delete_post(p_post_id uuid)
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
  update public.posts set deleted_at = now()
  where id = p_post_id and author_id = v_uid and deleted_at is null;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  update public.profile_stats set posts_count = greatest(posts_count - 1, 0) where user_id = v_uid;
  perform private.emit_event(
    'post.deleted', jsonb_build_object('post_id', p_post_id, 'author_id', v_uid)
  );
end;
$$;
grant execute on function public.delete_post(uuid) to authenticated;

create or replace function public.like_post(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_rows integer;
  v_author uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select p.author_id into v_author from public.posts p
  where p.id = p_post_id and p.deleted_at is null and p.status in ('published', 'restricted')
    and private.can_view_post(p.author_id, p.visibility, v_uid);
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not private.is_action_allowed(v_uid, 'like') then
    raise exception 'action_restricted' using errcode = 'P0001';
  end if;
  insert into public.likes (post_id, user_id) values (p_post_id, v_uid) on conflict do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 1 then
    update public.post_stats set like_count = like_count + 1 where post_id = p_post_id;
    perform private.emit_event(
      'post.liked', jsonb_build_object('post_id', p_post_id, 'user_id', v_uid, 'author_id', v_author)
    );
  end if;
end;
$$;
grant execute on function public.like_post(uuid) to authenticated;

create or replace function public.unlike_post(p_post_id uuid)
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
  delete from public.likes where post_id = p_post_id and user_id = v_uid;
  if found then
    update public.post_stats set like_count = greatest(like_count - 1, 0) where post_id = p_post_id;
  end if;
end;
$$;
grant execute on function public.unlike_post(uuid) to authenticated;

create or replace function public.save_post(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_rows integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.posts p
    where p.id = p_post_id and p.deleted_at is null and p.status in ('published', 'restricted')
      and private.can_view_post(p.author_id, p.visibility, v_uid)
  ) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  insert into public.saves (post_id, user_id) values (p_post_id, v_uid) on conflict do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 1 then
    update public.post_stats set save_count = save_count + 1 where post_id = p_post_id;
  end if;
end;
$$;
grant execute on function public.save_post(uuid) to authenticated;

create or replace function public.unsave_post(p_post_id uuid)
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
  delete from public.saves where post_id = p_post_id and user_id = v_uid;
  if found then
    update public.post_stats set save_count = greatest(save_count - 1, 0) where post_id = p_post_id;
  end if;
end;
$$;
grant execute on function public.unsave_post(uuid) to authenticated;

create or replace function public.add_comment(
  p_post_id uuid,
  p_body text,
  p_parent_id uuid default null
)
returns public.comments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_body text := btrim(coalesce(p_body, ''));
  v_enabled boolean;
  v_post_author uuid;
  v_parent_post uuid;
  v_parent_parent uuid;
  v_comment public.comments;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select p.comments_enabled, p.author_id into v_enabled, v_post_author
  from public.posts p
  where p.id = p_post_id and p.deleted_at is null and p.status in ('published', 'restricted')
    and private.can_view_post(p.author_id, p.visibility, v_uid);
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not v_enabled then
    raise exception 'comments_disabled' using errcode = 'P0001';
  end if;
  if not private.is_action_allowed(v_uid, 'comment') then
    raise exception 'action_restricted' using errcode = 'P0001';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 2200 then
    raise exception 'invalid_comment_body' using errcode = 'P0001';
  end if;
  if p_parent_id is not null then
    select c.post_id, c.parent_id into v_parent_post, v_parent_parent
    from public.comments c where c.id = p_parent_id and c.deleted_at is null;
    if not found or v_parent_post <> p_post_id or v_parent_parent is not null then
      raise exception 'invalid_parent' using errcode = 'P0001';
    end if;
  end if;

  insert into public.comments (post_id, author_id, parent_id, body)
  values (p_post_id, v_uid, p_parent_id, v_body)
  returning * into v_comment;
  update public.post_stats set comment_count = comment_count + 1 where post_id = p_post_id;
  perform private.emit_event(
    'comment.created',
    jsonb_build_object(
      'comment_id', v_comment.id, 'post_id', p_post_id, 'author_id', v_uid,
      'post_author_id', v_post_author, 'parent_id', p_parent_id
    )
  );
  return v_comment;
end;
$$;
grant execute on function public.add_comment(uuid, text, uuid) to authenticated;

create or replace function public.delete_comment(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_post uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  update public.comments c set deleted_at = now()
  where c.id = p_comment_id and c.deleted_at is null
    and (
      c.author_id = v_uid
      or exists (select 1 from public.posts p where p.id = c.post_id and p.author_id = v_uid)
    )
  returning c.post_id into v_post;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  update public.post_stats set comment_count = greatest(comment_count - 1, 0) where post_id = v_post;
end;
$$;
grant execute on function public.delete_comment(uuid) to authenticated;
