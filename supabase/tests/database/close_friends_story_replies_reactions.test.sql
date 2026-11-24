-- Tests for close friends stories, story replies, message reactions and unsend.
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
  ('00000000-0000-4000-8000-0000000000f1', 'cf_a@test.invalid', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f2', 'cf_b@test.invalid', now(), 'authenticated', 'authenticated');
insert into public.profiles (id, username, is_private) values
  ('00000000-0000-4000-8000-0000000000f1', 'cf_a', false),
  ('00000000-0000-4000-8000-0000000000f2', 'cf_b', false);
insert into public.profile_stats (user_id) values
  ('00000000-0000-4000-8000-0000000000f1'), ('00000000-0000-4000-8000-0000000000f2') on conflict do nothing;
insert into public.media_assets (id, owner_id, kind, status, storage_key, mime_type, width, height, bytes) values
  ('00000000-0000-4000-8000-0000000000c9', '00000000-0000-4000-8000-0000000000f1', 'image', 'ready', '00000000-0000-4000-8000-0000000000f1/s.jpg', 'image/jpeg', 100, 100, 1000);
insert into public.stories (id, author_id, media_id, audience) values
  ('00000000-0000-4000-8000-0000000000d9', '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000c9', 'close_friends');

select pg_temp.act_as('00000000-0000-4000-8000-0000000000f2');
select is((select count(*)::int from public.stories), 0, 'a non-friend cannot see a close friends story');
select throws_ok($$select public.reply_to_story('00000000-0000-4000-8000-0000000000d9', 'hi')$$, 'P0002', null, 'a non-friend cannot reply');

select pg_temp.act_as('00000000-0000-4000-8000-0000000000f1');
select lives_ok($$select public.set_close_friend('00000000-0000-4000-8000-0000000000f2', true)$$, 'add a close friend');

select pg_temp.act_as('00000000-0000-4000-8000-0000000000f2');
select is((select count(*)::int from public.stories), 1, 'a close friend sees the story');
select is((select count(*)::int from public.close_friends), 0, 'the close friends list stays private');
create temp table m (id uuid);
grant all on m to authenticated;
insert into m select id from public.reply_to_story('00000000-0000-4000-8000-0000000000d9', 'love it');
select lives_ok(format($$select public.react_message(%L, '🔥')$$, (select id from m)), 'react to a message');
select throws_ok(format($$select public.react_message(%L, 'x')$$, (select id from m)), '23514', null, 'only the allowed emoji');
select lives_ok(format($$select public.unsend_message(%L)$$, (select id from m)), 'unsend my message');
select is((select count(*)::int from public.message_reactions), 0, 'unsending clears reactions');

select * from finish();
rollback;
