-- RLS and RPC tests for posts, media, likes, saves and comments.
-- Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create function pg_temp.act_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
end $$;

-- Fixtures: A is the author, C is a stranger.
insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('00000000-0000-4000-8000-00000000000a', 'a@test.invalid', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000c', 'c@test.invalid', now(), 'authenticated', 'authenticated');
insert into public.profiles (id, username) values
  ('00000000-0000-4000-8000-00000000000a', 'tap_author'),
  ('00000000-0000-4000-8000-00000000000c', 'tap_stranger');
insert into public.profile_stats (user_id) values
  ('00000000-0000-4000-8000-00000000000a'),
  ('00000000-0000-4000-8000-00000000000c')
  on conflict do nothing;
insert into public.media_assets (id, owner_id, kind, status, storage_key, mime_type) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000a', 'image', 'ready', 'tap/a1', 'image/jpeg'),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-00000000000a', 'image', 'ready', 'tap/a2', 'image/jpeg'),
  ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-00000000000a', 'image', 'processing', 'tap/a3', 'image/jpeg');

-- Author publishes a public and a followers-only post.
select pg_temp.act_as('00000000-0000-4000-8000-00000000000a');
create temp table posts_made (public_id uuid, followers_id uuid);
grant all on posts_made to authenticated, anon;
insert into posts_made (public_id, followers_id)
select
  (select id from public.publish_post('hello', array['00000000-0000-4000-8000-0000000000a1']::uuid[], 'public')),
  (select id from public.publish_post('secret', array['00000000-0000-4000-8000-0000000000a2']::uuid[], 'followers'));

select is((select count(*)::int from public.posts), 2, 'author sees both of their posts');

select throws_ok(
  $$select public.publish_post('again', array['00000000-0000-4000-8000-0000000000a1']::uuid[])$$,
  'P0001', 'media_not_ready', 'media already attached to a post cannot be reused');
select throws_ok(
  $$select public.publish_post('x', array['00000000-0000-4000-8000-0000000000a3']::uuid[])$$,
  'P0001', 'media_not_ready', 'media that is not ready cannot be published');

-- Stranger.
select pg_temp.act_as('00000000-0000-4000-8000-00000000000c');
select is((select count(*)::int from public.posts), 1, 'a stranger sees only the public post');
select is((select count(*)::int from public.post_media), 1, 'post_media follows post visibility');
select throws_ok(
  format($f$select public.like_post(%L)$f$, (select followers_id from posts_made)),
  'P0002', 'not_found', 'a stranger cannot like a followers-only post');
select throws_ok(
  $$select public.publish_post('x', array['00000000-0000-4000-8000-0000000000a1']::uuid[])$$,
  'P0001', 'media_not_ready', 'a user cannot publish media they do not own');
select throws_ok(
  format($f$select public.delete_post(%L)$f$, (select public_id from posts_made)),
  'P0002', 'not_found', 'a stranger cannot delete someone else''s post');

select public.like_post((select public_id from posts_made));
select public.like_post((select public_id from posts_made));
select is(
  (select like_count from public.post_stats where post_id = (select public_id from posts_made)),
  1, 'liking twice counts once');

select public.add_comment((select public_id from posts_made), 'nice');
select is(
  (select comment_count from public.post_stats where post_id = (select public_id from posts_made)),
  1, 'comment count increments');

-- Anonymous.
select pg_temp.act_as_anon();
select is((select count(*)::int from public.posts), 1, 'anonymous users see only public posts');
select throws_ok(
  $$select public.publish_post('x', array['00000000-0000-4000-8000-0000000000a1']::uuid[])$$,
  '42501', null, 'anonymous users cannot execute publish_post');
select is((select count(*)::int from public.likes), 0, 'anonymous users cannot read likes');

-- Blocking hides the author from the blocked user.
select pg_temp.act_as('00000000-0000-4000-8000-00000000000a');
select public.block_user('00000000-0000-4000-8000-00000000000c');
select pg_temp.act_as('00000000-0000-4000-8000-00000000000c');
select is(
  (select count(*)::int from public.posts where author_id = '00000000-0000-4000-8000-00000000000a'),
  0, 'a blocked user no longer sees the blocker''s posts');
select throws_ok(
  format($f$select public.like_post(%L)$f$, (select public_id from posts_made)),
  'P0002', 'not_found', 'a blocked user cannot like the blocker''s post');

select * from finish();
rollback;
