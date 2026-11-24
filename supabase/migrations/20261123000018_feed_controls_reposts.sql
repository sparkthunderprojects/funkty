-- Feed controls (not interested, muted topics) and reposts with a note.

create table public.feed_not_interested (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create table public.muted_topics (
  user_id uuid not null references public.profiles (id) on delete cascade,
  tag text not null check (char_length(tag) between 1 and 50 and tag = lower(tag) and tag !~ '[\s#]'),
  created_at timestamptz not null default now(),
  primary key (user_id, tag)
);
create table public.reposts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  note text check (note is null or char_length(note) <= 150),
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index reposts_user_idx on public.reposts (user_id, created_at desc);
create index reposts_post_idx on public.reposts (post_id);

alter table public.feed_not_interested enable row level security;
alter table public.muted_topics enable row level security;
alter table public.reposts enable row level security;
create policy feed_not_interested_select_own on public.feed_not_interested for select to authenticated using (user_id = auth.uid());
create policy muted_topics_select_own on public.muted_topics for select to authenticated using (user_id = auth.uid());
-- A repost is visible to anyone who may see both the reposter and the post, and neither side has blocked the other.
create policy reposts_select on public.reposts for select to authenticated using (
  user_id = auth.uid()
  or (
    private.is_profile_visible(user_id, auth.uid())
    and not private.is_blocked_between(user_id, auth.uid())
    and exists (select 1 from public.posts p where p.id = post_id)
  )
);
revoke all on public.feed_not_interested, public.muted_topics, public.reposts from anon, authenticated;
grant select on public.feed_not_interested, public.muted_topics, public.reposts to authenticated;

create function public.not_interested(p_post uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if not exists (select 1 from public.posts p where p.id = p_post) then raise exception 'post_not_found' using errcode = 'P0002'; end if;
  insert into public.feed_not_interested (user_id, post_id) values (auth.uid(), p_post) on conflict do nothing;
end $$;

create function public.reset_not_interested() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  delete from public.feed_not_interested where user_id = auth.uid();
end $$;

create function public.mute_topic(p_tag text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_tag text := lower(regexp_replace(btrim(coalesce(p_tag, '')), '^#', ''));
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if char_length(v_tag) not between 1 and 50 or v_tag ~ '[\s#]' then raise exception 'invalid_topic' using errcode = 'P0001'; end if;
  if (select count(*) from public.muted_topics where user_id = auth.uid()) >= 100 then raise exception 'too_many_topics' using errcode = 'P0001'; end if;
  insert into public.muted_topics (user_id, tag) values (auth.uid(), v_tag) on conflict do nothing;
end $$;

create function public.unmute_topic(p_tag text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  delete from public.muted_topics where user_id = auth.uid() and tag = lower(p_tag);
end $$;

create function public.repost_post(p_post uuid, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_author uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if v_note is not null and char_length(v_note) > 150 then raise exception 'note_too_long' using errcode = 'P0001'; end if;
  select p.author_id into v_author from public.posts p
    join public.profiles a on a.id = p.author_id
    where p.id = p_post and p.archived_at is null and a.is_private = false
      and private.can_view_author(p.author_id, v_uid) and not private.is_blocked_between(p.author_id, v_uid);
  if v_author is null then raise exception 'post_not_found' using errcode = 'P0002'; end if;
  if v_author = v_uid then raise exception 'own_post' using errcode = 'P0001'; end if;
  if (select count(*) from public.reposts where user_id = v_uid and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.reposts (user_id, post_id, note) values (v_uid, p_post, v_note)
    on conflict (user_id, post_id) do update set note = excluded.note;
end $$;

create function public.unrepost_post(p_post uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  delete from public.reposts where user_id = auth.uid() and post_id = p_post;
end $$;

revoke all on function public.not_interested(uuid), public.reset_not_interested(), public.mute_topic(text),
  public.unmute_topic(text), public.repost_post(uuid, text), public.unrepost_post(uuid) from public, anon;
grant execute on function public.not_interested(uuid), public.reset_not_interested(), public.mute_topic(text),
  public.unmute_topic(text), public.repost_post(uuid, text), public.unrepost_post(uuid) to authenticated;
