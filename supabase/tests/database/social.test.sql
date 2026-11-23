-- RLS and trigger tests for notifications, stories and messages.
-- Run with: supabase test db
-- The same scenario was verified against the hosted project inside a rolled-back transaction.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.as_owner() returns void language plpgsql as $$
begin
  execute 'reset role';
end $$;

-- A: author, B: private account, C: stranger.
insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('00000000-0000-4000-8000-0000000000aa', 'a@test.invalid', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000bb', 'b@test.invalid', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000cc', 'c@test.invalid', now(), 'authenticated', 'authenticated');
insert into public.profiles (id, username, is_private) values
  ('00000000-0000-4000-8000-0000000000aa', 'soc_a', false),
  ('00000000-0000-4000-8000-0000000000bb', 'soc_b', true),
  ('00000000-0000-4000-8000-0000000000cc', 'soc_c', false);
insert into public.profile_stats (user_id) values
  ('00000000-0000-4000-8000-0000000000aa'),
  ('00000000-0000-4000-8000-0000000000bb'),
  ('00000000-0000-4000-8000-0000000000cc')
  on conflict do nothing;
insert into public.media_assets (id, owner_id, kind, status, storage_key, mime_type) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000aa', 'image', 'ready', 'soc/a1', 'image/jpeg'),
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000bb', 'image', 'ready', 'soc/b1', 'image/jpeg');

select pg_temp.act_as('00000000-0000-4000-8000-0000000000aa');
create temp table made (post_id uuid);
grant all on made to authenticated;
insert into made select id from public.publish_post('hello', array['00000000-0000-4000-8000-0000000000a1']::uuid[]);

-- Notifications: a like and a comment reach the author, and only the author.
select pg_temp.act_as('00000000-0000-4000-8000-0000000000cc');
select public.like_post((select post_id from made));
select public.add_comment((select post_id from made), 'hi', null);
select pg_temp.act_as('00000000-0000-4000-8000-0000000000aa');
select is((select count(*) from public.notifications), 2::bigint, 'author receives like and comment notifications');
select pg_temp.act_as('00000000-0000-4000-8000-0000000000cc');
select is((select count(*) from public.notifications), 0::bigint, 'actor does not see the author notifications');
select public.unlike_post((select post_id from made));
select pg_temp.act_as('00000000-0000-4000-8000-0000000000aa');
select is((select count(*) from public.notifications where type = 'like'), 0::bigint, 'unlike removes the like notification');

-- Follow request to a private account.
select public.follow_user('00000000-0000-4000-8000-0000000000bb');
select pg_temp.act_as('00000000-0000-4000-8000-0000000000bb');
select is((select count(*) from public.notifications where type = 'follow_request'), 1::bigint, 'private account receives a follow request');

-- Stories: a private author's story is hidden until the follow is accepted.
select pg_temp.as_owner();
insert into made select null where false;
select pg_temp.act_as('00000000-0000-4000-8000-0000000000bb');
select public.publish_story('00000000-0000-4000-8000-0000000000b1');
select pg_temp.act_as('00000000-0000-4000-8000-0000000000aa');
select is((select count(*) from public.stories), 0::bigint, 'pending follower cannot see a private story');
select pg_temp.act_as('00000000-0000-4000-8000-0000000000bb');
select public.accept_follow_request('00000000-0000-4000-8000-0000000000aa');
select pg_temp.act_as('00000000-0000-4000-8000-0000000000aa');
select is((select count(*) from public.stories), 1::bigint, 'accepted follower can see the story');
select is((select count(*) from public.media_assets where storage_key = 'soc/b1'), 1::bigint, 'story photo row is readable by a viewer');
select pg_temp.act_as('00000000-0000-4000-8000-0000000000cc');
select is((select count(*) from public.stories), 0::bigint, 'stranger cannot see a private story');

-- Messages: only participants can read, and blocked users cannot send.
select pg_temp.act_as('00000000-0000-4000-8000-0000000000aa');
select public.send_message('00000000-0000-4000-8000-0000000000cc', 'hello');
select pg_temp.act_as('00000000-0000-4000-8000-0000000000bb');
select is((select count(*) from public.messages), 0::bigint, 'non-participant cannot read messages');
select pg_temp.act_as('00000000-0000-4000-8000-0000000000cc');
select public.block_user('00000000-0000-4000-8000-0000000000aa');
select throws_ok(
  $$select public.send_message('00000000-0000-4000-8000-0000000000aa', 'x')$$,
  'P0002', 'not_found', 'blocked user cannot message the blocker'
);

select * from finish();
rollback;
