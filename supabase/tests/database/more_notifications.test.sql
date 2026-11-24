-- Tests for repost, comment like, story reply and held comment notifications.
-- Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('00000000-0000-4000-8000-0000000000d1', 'nt_a@test.invalid', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000d2', 'nt_b@test.invalid', now(), 'authenticated', 'authenticated');
insert into public.profiles (id, username, is_private) values
  ('00000000-0000-4000-8000-0000000000d1', 'nt_a', false),
  ('00000000-0000-4000-8000-0000000000d2', 'nt_b', false);
insert into public.profile_stats (user_id) values
  ('00000000-0000-4000-8000-0000000000d1'), ('00000000-0000-4000-8000-0000000000d2') on conflict do nothing;
insert into public.media_assets (id, owner_id, kind, status, storage_key, mime_type, width, height, bytes) values
  ('00000000-0000-4000-8000-0000000000d8', '00000000-0000-4000-8000-0000000000d1', 'image', 'ready', '00000000-0000-4000-8000-0000000000d1/a.jpg', 'image/jpeg', 100, 100, 1000);

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d1');
create temp table made (p uuid, c uuid);
grant all on made to authenticated;
insert into made (p) select id from public.publish_post('hi', array['00000000-0000-4000-8000-0000000000d8']::uuid[]);
select public.set_account_controls(true, array[]::text[], true);

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d2');
select public.repost_post((select p from made), null);
update made set c = (select id from public.add_comment((select p from made), 'waiting'));

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d1');
select is((select count(*)::int from public.notifications where type = 'repost'), 1, 'author is told about a repost');
select is((select count(*)::int from public.notifications where type = 'comment_held'), 1, 'author is told a comment is waiting');
select public.approve_comment((select c from made));
select is((select count(*)::int from public.notifications where type = 'comment' and comment_id = (select c from made)), 1, 'approving turns it into a comment notice');
select public.like_comment((select c from made));

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d2');
select is((select count(*)::int from public.notifications where type = 'comment_like'), 1, 'comment author is told about a like');
select public.like_comment((select c from made));
select is((select count(*)::int from public.notifications where type = 'comment_like' and actor_id = '00000000-0000-4000-8000-0000000000d2'), 0, 'no notice for liking your own comment');
select public.unrepost_post((select p from made));
select pg_temp.act_as('00000000-0000-4000-8000-0000000000d1');
select is((select count(*)::int from public.notifications where type = 'repost'), 0, 'unreposting removes the notice');

select * from finish();
rollback;
