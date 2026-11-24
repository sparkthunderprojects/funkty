-- Comment controls (approve first, hidden words) and a switch for reposts.

create table public.account_controls (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  require_comment_approval boolean not null default false,
  comment_words text[] not null default '{}',
  allow_reposts boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.account_controls enable row level security;
create policy account_controls_select_own on public.account_controls for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.account_controls from anon, authenticated;
grant select on public.account_controls to authenticated;

create function public.set_account_controls(p_require_approval boolean, p_words text[], p_allow_reposts boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_words text[];
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select coalesce(array_agg(distinct w), '{}') into v_words
  from (select lower(btrim(x)) as w from unnest(coalesce(p_words, '{}')) as x) t where w <> '';
  if array_length(v_words, 1) > 50 or exists (select 1 from unnest(v_words) w where char_length(w) > 40) then
    raise exception 'invalid_words' using errcode = 'P0001';
  end if;
  insert into public.account_controls (user_id, require_comment_approval, comment_words, allow_reposts)
  values (auth.uid(), coalesce(p_require_approval, false), v_words, coalesce(p_allow_reposts, true))
  on conflict (user_id) do update set require_comment_approval = excluded.require_comment_approval,
    comment_words = excluded.comment_words, allow_reposts = excluded.allow_reposts, updated_at = now();
end $$;

-- Held comments: visible only to the commenter and the post author until approved.
alter table public.comments add column held_at timestamptz;

alter policy comments_select on public.comments using (
  deleted_at is null
  and status = 'published'
  and exists (select 1 from public.posts p where p.id = comments.post_id)
  and (
    author_id = (select auth.uid())
    or not private.is_blocked_between(author_id, (select auth.uid()))
  )
  and (
    held_at is null
    or author_id = (select auth.uid())
    or exists (select 1 from public.posts p where p.id = comments.post_id and p.author_id = (select auth.uid()))
  )
);

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
  v_req boolean;
  v_words text[];
  v_held boolean;
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

  -- The post author's own comments are never held.
  select ac.require_comment_approval, ac.comment_words into v_req, v_words
  from public.account_controls ac where ac.user_id = v_post_author;
  v_held := v_uid <> v_post_author and (
    coalesce(v_req, false)
    or exists (select 1 from unnest(coalesce(v_words, '{}')) w where position(w in lower(v_body)) > 0)
  );

  insert into public.comments (post_id, author_id, parent_id, body, held_at)
  values (p_post_id, v_uid, p_parent_id, v_body, case when v_held then now() end)
  returning * into v_comment;
  if not v_held then
    update public.post_stats set comment_count = comment_count + 1 where post_id = p_post_id;
    perform private.emit_event(
      'comment.created',
      jsonb_build_object(
        'comment_id', v_comment.id, 'post_id', p_post_id, 'author_id', v_uid,
        'post_author_id', v_post_author, 'parent_id', p_parent_id
      )
    );
  end if;
  return v_comment;
end;
$$;

create function public.approve_comment(p_comment_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_post uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  update public.comments c set held_at = null
  from public.posts p
  where c.id = p_comment_id and c.held_at is not null and c.deleted_at is null and p.id = c.post_id and p.author_id = auth.uid()
  returning c.post_id into v_post;
  if v_post is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  update public.post_stats set comment_count = comment_count + 1 where post_id = v_post;
end $$;

-- Held comments were never counted, so removing one leaves the count alone.
create function public.reject_comment(p_comment_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  update public.comments c set deleted_at = now()
  from public.posts p
  where c.id = p_comment_id and c.held_at is not null and c.deleted_at is null and p.id = c.post_id and p.author_id = auth.uid()
  returning c.id into v_id;
  if v_id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
end $$;

-- Reposts can be switched off by the author.
create or replace function public.repost_post(p_post uuid, p_note text default null) returns void
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
  if not coalesce((select allow_reposts from public.account_controls where user_id = v_author), true) then
    raise exception 'reposts_off' using errcode = 'P0001';
  end if;
  if (select count(*) from public.reposts where user_id = v_uid and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.reposts (user_id, post_id, note) values (v_uid, p_post, v_note)
    on conflict (user_id, post_id) do update set note = excluded.note;
end $$;

revoke all on function public.set_account_controls(boolean, text[], boolean), public.approve_comment(uuid), public.reject_comment(uuid) from public, anon;
grant execute on function public.set_account_controls(boolean, text[], boolean), public.approve_comment(uuid), public.reject_comment(uuid) to authenticated;
