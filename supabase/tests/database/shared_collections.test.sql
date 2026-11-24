-- Tests for shared collections.
-- Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('00000000-0000-4000-8000-0000000000f1', 'sc_a@test.invalid', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f2', 'sc_b@test.invalid', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f3', 'sc_c@test.invalid', now(), 'authenticated', 'authenticated');
insert into public.profiles (id, username, is_private) values
  ('00000000-0000-4000-8000-0000000000f1', 'sc_a', false),
  ('00000000-0000-4000-8000-0000000000f2', 'sc_b', false),
  ('00000000-0000-4000-8000-0000000000f3', 'sc_c', false);
insert into public.profile_stats (user_id) values
  ('00000000-0000-4000-8000-0000000000f1'), ('00000000-0000-4000-8000-0000000000f2'), ('00000000-0000-4000-8000-0000000000f3') on conflict do nothing;
insert into public.media_assets (id, owner_id, kind, status, storage_key, mime_type, width, height, bytes) values
  ('00000000-0000-4000-8000-0000000000f8', '00000000-0000-4000-8000-0000000000f1', 'image', 'ready', '00000000-0000-4000-8000-0000000000f1/a.jpg', 'image/jpeg', 100, 100, 1000),
  ('00000000-0000-4000-8000-0000000000f9', '00000000-0000-4000-8000-0000000000f1', 'image', 'ready', '00000000-0000-4000-8000-0000000000f1/b.jpg', 'image/jpeg', 100, 100, 1000);

select pg_temp.act_as('00000000-0000-4000-8000-0000000000f1');
create temp table made (p1 uuid, p2 uuid, col uuid);
grant all on made to authenticated;
insert into made (p1) select id from public.publish_post('one', array['00000000-0000-4000-8000-0000000000f8']::uuid[]);
update made set p2 = (select id from public.publish_post('two', array['00000000-0000-4000-8000-0000000000f9']::uuid[]));
update made set col = (select id from public.create_collection('trip'));
select throws_ok(format($$select public.invite_to_collection(%L, '00000000-0000-4000-8000-0000000000f2')$$, (select col from made)), 'P0001', 'not_mutual', 'only mutual followers can be invited');
select public.follow_user('00000000-0000-4000-8000-0000000000f2');
select pg_temp.act_as('00000000-0000-4000-8000-0000000000f2');
select public.follow_user('00000000-0000-4000-8000-0000000000f1');
select pg_temp.act_as('00000000-0000-4000-8000-0000000000f1');
select lives_ok(format($$select public.invite_to_collection(%L, '00000000-0000-4000-8000-0000000000f2')$$, (select col from made)), 'invite a mutual follower');

select pg_temp.act_as('00000000-0000-4000-8000-0000000000f2');
select is((select count(*)::int from public.collections), 1, 'the invitee can see the collection');
select throws_ok(format($$select public.set_collection_post(%L, %L, true)$$, (select col from made), (select p1 from made)), 'P0002', null, 'an invited person cannot add posts yet');
select public.respond_collection_invite((select col from made), true);
select public.set_collection_post((select col from made), (select p1 from made), true);

select pg_temp.act_as('00000000-0000-4000-8000-0000000000f3');
select is((select count(*)::int from public.collections), 0, 'outsiders cannot see the collection');

select pg_temp.act_as('00000000-0000-4000-8000-0000000000f1');
select public.set_collection_post((select col from made), (select p2 from made), true);
select pg_temp.act_as('00000000-0000-4000-8000-0000000000f2');
select public.set_collection_post((select col from made), (select p2 from made), false);
select is((select count(*)::int from public.collection_posts), 2, 'a member cannot remove posts they did not add');
select public.set_collection_post((select col from made), (select p1 from made), false);
select is((select count(*)::int from public.collection_posts), 1, 'a member removes their own post');
select public.remove_collection_member((select col from made), '00000000-0000-4000-8000-0000000000f2');
select is((select count(*)::int from public.collections), 0, 'leaving removes access');

select * from finish();
rollback;
