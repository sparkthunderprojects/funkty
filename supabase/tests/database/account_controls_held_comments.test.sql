-- Tests for comment approval, hidden words and the repost switch.
-- Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('00000000-0000-4000-8000-0000000000b1', 'ac_a@test.invalid', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b2', 'ac_b@test.invalid', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b3', 'ac_c@test.invalid', now(), 'authenticated', 'authenticated');
insert into public.profiles (id, username, is_private) values
  ('00000000-0000-4000-8000-0000000000b1', 'ac_a', false),
  ('00000000-0000-4000-8000-0000000000b2', 'ac_b', false),
  ('00000000-0000-4000-8000-0000000000b3', 'ac_c', false);
insert into public.profile_stats (user_id) values
  ('00000000-0000-4000-8000-0000000000b1'), ('00000000-0000-4000-8000-0000000000b2'), ('00000000-0000-4000-8000-0000000000b3') on conflict do nothing;
insert into public.media_assets (id, owner_id, kind, status, storage_key, mime_type, width, height, bytes) values
  ('00000000-0000-4000-8000-0000000000b8', '00000000-0000-4000-8000-0000000000b1', 'image', 'ready', '00000000-0000-4000-8000-0000000000b1/a.jpg', 'image/jpeg', 100, 100, 1000);

select pg_temp.act_as('00000000-0000-4000-8000-0000000000b1');
create temp table made (p uuid);
grant all on made to authenticated;
insert into made select id from public.publish_post('hello', array['00000000-0000-4000-8000-0000000000b8']::uuid[]);
select throws_ok($$select public.set_account_controls(false, array[repeat('x', 41)], true)$$, 'P0001', null, 'words over 40 characters are refused');
select lives_ok($$select public.set_account_controls(false, array['Spoiler', 'spoiler', 'rude'], true)$$, 'set hidden words');
select is((select array_length(comment_words, 1) from public.account_controls), 2, 'words are lowercased and de-duplicated');

select pg_temp.act_as('00000000-0000-4000-8000-0000000000b2');
select lives_ok(format($$select public.add_comment(%L, 'what a Spoiler')$$, (select p from made)), 'a matching comment is accepted');
select lives_ok(format($$select public.add_comment(%L, 'nice one')$$, (select p from made)), 'a clean comment is accepted');
select is((select count(*)::int from public.comments where held_at is not null), 1, 'the commenter sees their held comment');

select pg_temp.act_as('00000000-0000-4000-8000-0000000000b3');
select is((select count(*)::int from public.comments), 1, 'others see only the clean comment');

select pg_temp.act_as('00000000-0000-4000-8000-0000000000b1');
select is((select comment_count from public.posts where id = (select p from made)), 1, 'held comments are not counted');
select lives_ok($$select public.approve_comment((select id from public.comments where held_at is not null))$$, 'the author can approve');
select is((select comment_count from public.posts where id = (select p from made)), 2, 'approving counts the comment');

select public.set_account_controls(false, array[]::text[], false);
select pg_temp.act_as('00000000-0000-4000-8000-0000000000b3');
select throws_ok(format($$select public.repost_post(%L, null)$$, (select p from made)), 'P0001', null, 'reposts are refused when switched off');

select * from finish();
rollback;
