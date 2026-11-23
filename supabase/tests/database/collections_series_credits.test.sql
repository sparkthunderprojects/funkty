-- Tests for collections, series, credits and message request decisions.
-- Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('00000000-0000-4000-8000-0000000000d1', 'cs_a@test.invalid', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000d2', 'cs_b@test.invalid', now(), 'authenticated', 'authenticated');
insert into public.profiles (id, username, is_private) values
  ('00000000-0000-4000-8000-0000000000d1', 'cs_a', false),
  ('00000000-0000-4000-8000-0000000000d2', 'cs_b', false);
insert into public.profile_stats (user_id) values
  ('00000000-0000-4000-8000-0000000000d1'), ('00000000-0000-4000-8000-0000000000d2') on conflict do nothing;
insert into public.media_assets (id, owner_id, kind, status, storage_key, mime_type, width, height, bytes) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000d1', 'image', 'ready', '00000000-0000-4000-8000-0000000000d1/a.jpg', 'image/jpeg', 100, 100, 1000);

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d1');
create temp table made (post_id uuid, coll uuid, ser uuid);
grant all on made to authenticated;
insert into made (post_id) select id from public.publish_post('hello', array['00000000-0000-4000-8000-0000000000e1']::uuid[]);
update made set coll = (public.create_collection('Ideas')).id, ser = (public.create_series('Part one')).id;

select throws_ok($$select public.create_collection('ideas')$$, 'name_taken', 'collection names are unique per user');
select lives_ok($$select public.set_collection_post((select coll from made), (select post_id from made), true)$$, 'adds a post to a collection');
select is((select count(*)::int from public.saves where post_id = (select post_id from made)), 1, 'adding to a collection saves the post');
select lives_ok($$select public.set_post_series((select post_id from made), (select ser from made))$$, 'author puts own post in own series');
select lives_ok($$select public.set_post_credits((select post_id from made), '[{"role":"Photo","name":"Sam"}]'::jsonb)$$, 'author sets credits');
select throws_ok($$select public.set_post_credits((select post_id from made), '[{"role":"","name":"x"}]'::jsonb)$$, 'invalid_credits', 'empty credit role is rejected');
select throws_ok($$select public.set_post_compare((select post_id from made), true)$$, 'needs_two_images', 'compare needs exactly two images');

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d2');
select is((select count(*)::int from public.collections), 0, 'collections are private');
select throws_ok($$select public.set_post_series((select post_id from made), null)$$, 'not_found', 'others cannot change a post series');
select throws_ok($$select public.set_post_credits((select post_id from made), '[]'::jsonb)$$, 'not_found', 'others cannot change credits');

select * from finish();
rollback;
