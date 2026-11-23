-- Tests for the spoiler flag on posts.
-- Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('00000000-0000-4000-8000-0000000000f1', 'sp_a@test.invalid', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f2', 'sp_b@test.invalid', now(), 'authenticated', 'authenticated');
insert into public.profiles (id, username, is_private) values
  ('00000000-0000-4000-8000-0000000000f1', 'sp_a', false),
  ('00000000-0000-4000-8000-0000000000f2', 'sp_b', false);
insert into public.profile_stats (user_id) values
  ('00000000-0000-4000-8000-0000000000f1'), ('00000000-0000-4000-8000-0000000000f2')
  on conflict do nothing;
insert into public.media_assets (id, owner_id, kind, status, storage_key, mime_type, width, height, bytes) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000f1', 'image', 'ready', '00000000-0000-4000-8000-0000000000f1/a.jpg', 'image/jpeg', 100, 100, 1000),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000f1', 'image', 'ready', '00000000-0000-4000-8000-0000000000f1/b.jpg', 'image/jpeg', 100, 100, 1000);

select pg_temp.act_as('00000000-0000-4000-8000-0000000000f1');
create temp table made (post_id uuid);
grant all on made to authenticated;
insert into made select id from public.publish_post('plain', array['00000000-0000-4000-8000-0000000000a1']::uuid[]);
select is((select is_spoiler from public.posts where id = (select post_id from made)), false, 'posts are not spoilers by default');

insert into made select id from public.publish_post('twist', array['00000000-0000-4000-8000-0000000000a2']::uuid[], p_is_spoiler => true);
select is((select is_spoiler from public.posts where caption = 'twist'), true, 'the author can publish a post marked as a spoiler');

select lives_ok($$select public.edit_post((select id from public.posts where caption = 'twist'), 'twist', null, false)$$, 'the author can remove the spoiler mark');
select is((select is_spoiler from public.posts where caption = 'twist'), false, 'the mark is removed');

select pg_temp.act_as('00000000-0000-4000-8000-0000000000f2');
select throws_ok(
  $$select public.edit_post((select id from public.posts where caption = 'twist'), 'twist', null, true)$$,
  'P0002', 'not_found', 'someone else cannot change the spoiler mark');

select * from finish();
rollback;
