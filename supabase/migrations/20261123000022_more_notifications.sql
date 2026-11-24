-- Notifications for reposts, comment likes, story replies and comments waiting for approval.
-- All written by triggers; clients can only read their own (existing RLS).

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array['like', 'comment', 'follow', 'follow_request', 'tag_request', 'repost', 'comment_like', 'story_reply', 'comment_held']));

-- Reposts -> the post's author
create or replace function private.notify_repost()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_author uuid;
begin
  select p.author_id into v_author from public.posts p where p.id = new.post_id;
  if v_author is not null and v_author <> new.user_id and not private.is_blocked_between(v_author, new.user_id) then
    insert into public.notifications (user_id, actor_id, type, post_id) values (v_author, new.user_id, 'repost', new.post_id);
  end if;
  return new;
end $$;
create trigger reposts_notify after insert on public.reposts for each row execute function private.notify_repost();

create or replace function private.unnotify_repost()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.notifications where type = 'repost' and actor_id = old.user_id and post_id = old.post_id;
  return old;
end $$;
create trigger reposts_unnotify after delete on public.reposts for each row execute function private.unnotify_repost();

-- Comment likes -> the comment's author
create or replace function private.notify_comment_like()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_author uuid; v_post uuid;
begin
  select c.author_id, c.post_id into v_author, v_post from public.comments c where c.id = new.comment_id and c.deleted_at is null and c.held_at is null;
  if v_author is not null and v_author <> new.user_id and not private.is_blocked_between(v_author, new.user_id) then
    insert into public.notifications (user_id, actor_id, type, post_id, comment_id) values (v_author, new.user_id, 'comment_like', v_post, new.comment_id);
  end if;
  return new;
end $$;
create trigger comment_likes_notify after insert on public.comment_likes for each row execute function private.notify_comment_like();

create or replace function private.unnotify_comment_like()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.notifications where type = 'comment_like' and actor_id = old.user_id and comment_id = old.comment_id;
  return old;
end $$;
create trigger comment_likes_unnotify after delete on public.comment_likes for each row execute function private.unnotify_comment_like();

-- Story replies -> the story's author (the message recipient)
create or replace function private.notify_story_reply()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.story_id is not null and old.story_id is null and not private.is_blocked_between(new.recipient_id, new.sender_id) then
    insert into public.notifications (user_id, actor_id, type) values (new.recipient_id, new.sender_id, 'story_reply');
  end if;
  return new;
end $$;
create trigger messages_story_reply_notify after update of story_id on public.messages for each row execute function private.notify_story_reply();

-- Held comments: the post author is told a comment is waiting; approving turns it into a normal comment notice.
create or replace function private.notify_comment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_author uuid;
begin
  select p.author_id into v_author from public.posts p where p.id = new.post_id;
  if v_author is not null and v_author <> new.author_id and not private.is_blocked_between(v_author, new.author_id) then
    insert into public.notifications (user_id, actor_id, type, post_id, comment_id)
    values (v_author, new.author_id, case when new.held_at is null then 'comment' else 'comment_held' end, new.post_id, new.id);
  end if;
  return new;
end $$;

create or replace function private.sync_comment_notice()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.held_at is not null and new.held_at is null and new.deleted_at is null then
    update public.notifications set type = 'comment' where type = 'comment_held' and comment_id = new.id;
  elsif old.deleted_at is null and new.deleted_at is not null then
    delete from public.notifications where comment_id = new.id and type in ('comment_held', 'comment_like');
  end if;
  return new;
end $$;
create trigger comments_sync_notice after update of held_at, deleted_at on public.comments for each row execute function private.sync_comment_notice();
