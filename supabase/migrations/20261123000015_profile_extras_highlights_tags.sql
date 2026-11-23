-- Profile cover photo, location and website; story highlights; consent-based post tags.

-- ---------- Profile extras ----------
alter table public.profiles
  add column cover_media_id uuid references public.media_assets (id) on delete set null,
  add column location text check (char_length(location) <= 40),
  add column website text check (
    char_length(website) <= 100
    and website ~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(/[^[:space:]]*)?$'
  );
create index profiles_cover_media_idx on public.profiles (cover_media_id) where cover_media_id is not null;
grant update (cover_media_id, location, website) on public.profiles to authenticated;

-- ---------- Highlights ----------
create table public.highlights (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 20),
  cover_media_id uuid references public.media_assets (id) on delete set null,
  created_at timestamptz not null default now()
);
create index highlights_owner_idx on public.highlights (owner_id, created_at);
create index highlights_cover_idx on public.highlights (cover_media_id) where cover_media_id is not null;
alter table public.highlights enable row level security;
create policy highlights_select on public.highlights for select to authenticated
  using (owner_id = (select auth.uid()) or private.can_view_author(owner_id, (select auth.uid())));

create table public.highlight_items (
  highlight_id uuid not null references public.highlights (id) on delete cascade,
  media_id uuid not null references public.media_assets (id) on delete cascade,
  story_id uuid references public.stories (id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (highlight_id, media_id)
);
create index highlight_items_media_idx on public.highlight_items (media_id);
create index highlight_items_story_idx on public.highlight_items (story_id) where story_id is not null;
alter table public.highlight_items enable row level security;
create policy highlight_items_select on public.highlight_items for select to authenticated
  using (exists (select 1 from public.highlights h where h.id = highlight_id));

grant select on public.highlights, public.highlight_items to authenticated;

alter policy media_assets_select on public.media_assets using (
  owner_id = (select auth.uid())
  or (
    status = 'ready'
    and (
      exists (select 1 from public.post_media pm where pm.media_id = media_assets.id)
      or exists (select 1 from public.profiles pr where pr.avatar_media_id = media_assets.id)
      or exists (select 1 from public.profiles pr where pr.cover_media_id = media_assets.id)
      or exists (select 1 from public.stories s where s.media_id = media_assets.id)
      or exists (select 1 from public.highlight_items hi where hi.media_id = media_assets.id)
    )
  )
);

-- Deleting a story also removes it from every highlight, so "delete" really removes it.
create function private.drop_highlight_items_for_story() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.highlight_items where story_id = new.id;
  return new;
end $$;
create trigger stories_drop_highlight_items after update of deleted_at on public.stories
  for each row when (new.deleted_at is not null) execute function private.drop_highlight_items_for_story();

create function private.refresh_highlight(p_highlight uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_cover uuid;
begin
  select media_id into v_cover from public.highlight_items where highlight_id = p_highlight order by added_at limit 1;
  if v_cover is null then
    delete from public.highlights where id = p_highlight;
  else
    update public.highlights set cover_media_id = v_cover where id = p_highlight;
  end if;
end $$;

create function public.create_highlight(p_title text, p_story_id uuid)
returns public.highlights
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_media uuid;
  v_row public.highlights;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if char_length(v_title) not between 1 and 20 then raise exception 'invalid_title' using errcode = 'P0001'; end if;
  select media_id into v_media from public.stories where id = p_story_id and author_id = v_uid and deleted_at is null;
  if v_media is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if (select count(*) from public.highlights where owner_id = v_uid) >= 20 then
    raise exception 'too_many_highlights' using errcode = 'P0001';
  end if;
  insert into public.highlights (owner_id, title, cover_media_id) values (v_uid, v_title, v_media) returning * into v_row;
  insert into public.highlight_items (highlight_id, media_id, story_id) values (v_row.id, v_media, p_story_id);
  return v_row;
end $$;

create function public.add_story_to_highlight(p_highlight_id uuid, p_story_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_media uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.highlights h where h.id = p_highlight_id and h.owner_id = v_uid) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select media_id into v_media from public.stories where id = p_story_id and author_id = v_uid and deleted_at is null;
  if v_media is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if (select count(*) from public.highlight_items where highlight_id = p_highlight_id) >= 50 then
    raise exception 'too_many_items' using errcode = 'P0001';
  end if;
  insert into public.highlight_items (highlight_id, media_id, story_id) values (p_highlight_id, v_media, p_story_id)
  on conflict do nothing;
end $$;

create function public.remove_highlight_item(p_highlight_id uuid, p_media_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.highlights h where h.id = p_highlight_id and h.owner_id = auth.uid()) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  delete from public.highlight_items where highlight_id = p_highlight_id and media_id = p_media_id;
  perform private.refresh_highlight(p_highlight_id);
end $$;

create function public.rename_highlight(p_highlight_id uuid, p_title text)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_title text := btrim(coalesce(p_title, ''));
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if char_length(v_title) not between 1 and 20 then raise exception 'invalid_title' using errcode = 'P0001'; end if;
  update public.highlights set title = v_title where id = p_highlight_id and owner_id = auth.uid();
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
end $$;

create function public.delete_highlight(p_highlight_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  delete from public.highlights where id = p_highlight_id and owner_id = auth.uid();
end $$;

-- ---------- Tags: the tagged person must approve before the tag shows anywhere public ----------
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array['like', 'comment', 'follow', 'follow_request', 'tag_request']));

create table public.post_tags (
  post_id uuid not null references public.posts (id) on delete cascade,
  tagged_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  primary key (post_id, tagged_id)
);
create index post_tags_tagged_idx on public.post_tags (tagged_id, status, created_at desc);
alter table public.post_tags enable row level security;
create policy post_tags_select on public.post_tags for select to authenticated
  using (
    exists (select 1 from public.posts p where p.id = post_id)
    and (
      status = 'approved'
      or tagged_id = (select auth.uid())
      or (status = 'pending' and exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid())))
    )
  );
grant select on public.post_tags to authenticated;

create function public.tag_user(p_post_id uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_user = v_uid then raise exception 'invalid_target' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.posts p where p.id = p_post_id and p.author_id = v_uid and p.deleted_at is null) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not private.is_action_allowed(v_uid, 'post') then raise exception 'action_restricted' using errcode = 'P0001'; end if;
  if not private.is_profile_visible(p_user, v_uid) or private.is_blocked_between(v_uid, p_user) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if (select count(*) from public.post_tags where post_id = p_post_id) >= 10 then
    raise exception 'too_many_tags' using errcode = 'P0001';
  end if;
  -- Anti-spam: at most 20 new tag requests per hour across all of the author's posts.
  if (
    select count(*) from public.post_tags t join public.posts p on p.id = t.post_id
    where p.author_id = v_uid and t.created_at > now() - interval '1 hour'
  ) >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  -- A declined tag stays declined: tagging again does nothing and does not notify.
  if exists (select 1 from public.post_tags where post_id = p_post_id and tagged_id = p_user) then
    return;
  end if;
  insert into public.post_tags (post_id, tagged_id) values (p_post_id, p_user);
  insert into public.notifications (user_id, actor_id, type, post_id) values (p_user, v_uid, 'tag_request', p_post_id);
end $$;

create function public.untag_user(p_post_id uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  delete from public.post_tags t using public.posts p
  where t.post_id = p_post_id and t.tagged_id = p_user and p.id = t.post_id and p.author_id = auth.uid()
    and t.status <> 'declined';
end $$;

-- The tagged person approves, declines, or later removes themselves (which counts as declining).
create function public.respond_tag(p_post_id uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  update public.post_tags set status = case when p_accept then 'approved' else 'declined' end
  where post_id = p_post_id and tagged_id = auth.uid();
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
end $$;

-- ---------- Grants ----------
do $$
declare f text;
begin
  foreach f in array array[
    'create_highlight(text,uuid)', 'add_story_to_highlight(uuid,uuid)', 'remove_highlight_item(uuid,uuid)',
    'rename_highlight(uuid,text)', 'delete_highlight(uuid)',
    'tag_user(uuid,uuid)', 'untag_user(uuid,uuid)', 'respond_tag(uuid,boolean)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
