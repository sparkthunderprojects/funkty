-- Tests for not interested, muted topics and reposts.
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
  ('00000000-0000-4000-8000-0000000000e1', 'fc_a@test.invalid', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e2', 'fc_b@test.invalid', now(), 'authenticated', 'authenticated');
insert into public.profiles (id, username, is_private) values
  ('00000000-0000-4000-8000-0000000000e1', 'fc_a', false),
  ('00000000-0000-4000-8000-0000000000e2', 'fc_b', false);
insert into public.profile_stats (user_id) values
  ('00000000-0000-4000-8000-0000000000e1'), ('00000000-0000-4000-8000-0000000000e2') on conflict do nothing;
insert into public.media_assets (id, owner_id, kind, status, storage_key, mime_type, width, height, bytes) values
  ('00000000-0000-4000-8000-0000000000b9', '00000000-0000-4000-8000-0000000000e1', 'image', 'ready', '00000000-0000-4000-8000-0000000000e1/a.jpg', 'image/jpeg', 100, 100, 1000);

select pg_temp.act_as('00000000-0000-4000-8000-0000000000e1');
create temp table made (p uuid);
grant all on made to authenticated;
insert into made select id from public.publish_post('hello #cats', array['00000000-0000-4000-8000-0000000000b9']::uuid[]);
select throws_ok(format($$select public.repost_post(%L, null)$$, (select p from made)), 'P0001', null, 'cannot repost your own post');

select pg_temp.act_as('00000000-0000-4000-8000-0000000000e2');
select lives_ok(format($$select public.repost_post(%L, 'love this')$$, (select p from made)), 'repost with a note');
select is((select count(*)::int from public.reposts), 1, 'reposter sees the repost');
select throws_ok(format($$select public.repost_post(%L, %L)$$, (select p from made), repeat('x', 151)), 'P0001', null, 'note over 150 characters is refused');
select lives_ok(format($$select public.not_interested(%L)$$, (select p from made)), 'mark not interested');
select lives_ok($$select public.mute_topic('#Cats')$$, 'mute a topic');
select is((select tag from public.muted_topics), 'cats', 'topic stored lower case without the hash');

select pg_temp.act_as('00000000-0000-4000-8000-0000000000e1');
select is((select count(*)::int from public.feed_not_interested), 0, 'others cannot read my not-interested list');
select is((select count(*)::int from public.muted_topics), 0, 'others cannot read my muted topics');

select * from finish();
rollback;
