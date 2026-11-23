-- Tests for comment replies and video registration.
-- Run with: supabase test db
-- The same scenario was verified against the hosted project inside a rolled-back transaction.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

-- A: post author, B: top-level commenter, C: replier.
insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('00000000-0000-4000-8000-0000000000d1', 'rva@test.invalid', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000d2', 'rvb@test.invalid', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000d3', 'rvc@test.invalid', now(), 'authenticated', 'authenticated');
insert into public.profiles (id, username, is_private) values
  ('00000000-0000-4000-8000-0000000000d1', 'rv_a', false),
  ('00000000-0000-4000-8000-0000000000d2', 'rv_b', false),
  ('00000000-0000-4000-8000-0000000000d3', 'rv_c', false);
insert into public.profile_stats (user_id) values
  ('00000000-0000-4000-8000-0000000000d1'),
  ('00000000-0000-4000-8000-0000000000d2'),
  ('00000000-0000-4000-8000-0000000000d3')
  on conflict do nothing;
insert into public.media_assets (id, owner_id, kind, status, storage_key, mime_type, duration_ms) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000d1', 'video', 'ready',
   '00000000-0000-4000-8000-0000000000d1/v1.mp4', 'video/mp4', 5000);

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d1');
create temp table made (post_id uuid);
grant all on made to authenticated;
insert into made select id from public.publish_post('clip', array['00000000-0000-4000-8000-0000000000e1']::uuid[]);
select is((select kind from public.posts where id = (select post_id from made)), 'video', 'a post with one video asset is a video post');

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d2');
create temp table top_comment (id uuid);
grant all on top_comment to authenticated;
insert into top_comment select id from public.add_comment((select post_id from made), 'top', null);

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d3');
select public.add_comment((select post_id from made), 'reply', (select id from top_comment));

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d2');
select is((select count(*) from public.notifications where type = 'comment' and actor_id = '00000000-0000-4000-8000-0000000000d3'),
  1::bigint, 'the person replied to is notified');
select pg_temp.act_as('00000000-0000-4000-8000-0000000000d1');
select is((select count(*) from public.notifications where type = 'comment'), 2::bigint, 'the post author is notified of the comment and the reply');
select pg_temp.act_as('00000000-0000-4000-8000-0000000000d3');
select is((select count(*) from public.notifications), 0::bigint, 'the replier is not notified of their own reply');
select throws_ok(
  $$select public.add_comment((select post_id from made), 'nested', (select c.id from public.comments c where c.parent_id is not null limit 1))$$,
  'invalid_parent', null, 'replies are one level deep');

select throws_ok($$select public.register_video('00000000-0000-4000-8000-0000000000d2/x.mp4', 'video/mp4', 1000, 5000)$$,
  'invalid_storage_key', null, 'a video must be registered under the caller''s own folder');
select throws_ok($$select public.register_video('00000000-0000-4000-8000-0000000000d3/x.mp4', 'video/mp4', 1000, 200000)$$,
  'invalid_duration', null, 'videos longer than 90 seconds are rejected');
select throws_ok($$select public.register_video('00000000-0000-4000-8000-0000000000d3/x.mp4', 'image/png', 1000, 5000)$$,
  'invalid_mime_type', null, 'only video types are accepted');
select throws_ok($$select public.register_video('00000000-0000-4000-8000-0000000000d3/x.mp4', 'video/mp4', 1000, 5000)$$,
  'object_missing', null, 'the uploaded object must exist');

select * from finish();
rollback;
