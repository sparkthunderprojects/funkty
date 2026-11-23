-- Tests for private notes on saved posts.
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
  ('00000000-0000-4000-8000-0000000000b1', 'sn_a@test.invalid', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b2', 'sn_b@test.invalid', now(), 'authenticated', 'authenticated');
insert into public.profiles (id, username, is_private) values
  ('00000000-0000-4000-8000-0000000000b1', 'sn_a', false),
  ('00000000-0000-4000-8000-0000000000b2', 'sn_b', false);
insert into public.profile_stats (user_id) values
  ('00000000-0000-4000-8000-0000000000b1'), ('00000000-0000-4000-8000-0000000000b2') on conflict do nothing;
insert into public.media_assets (id, owner_id, kind, status, storage_key, mime_type, width, height, bytes) values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000b1', 'image', 'ready', '00000000-0000-4000-8000-0000000000b1/a.jpg', 'image/jpeg', 100, 100, 1000);

select pg_temp.act_as('00000000-0000-4000-8000-0000000000b1');
create temp table made (post_id uuid);
grant all on made to authenticated;
insert into made select id from public.publish_post('recipe', array['00000000-0000-4000-8000-0000000000c1']::uuid[]);

select pg_temp.act_as('00000000-0000-4000-8000-0000000000b2');
select throws_ok(
  $$select public.set_save_note((select post_id from made), 'try this')$$,
  'P0002', 'not_found', 'a note needs the post to be saved first');
select public.save_post((select post_id from made));
select lives_ok($$select public.set_save_note((select post_id from made), '  try this on Sunday  ')$$, 'a saved post takes a note');
select is((select note from public.saves where user_id = '00000000-0000-4000-8000-0000000000b2'), 'try this on Sunday', 'the note is trimmed and stored');
select throws_ok(
  $$select public.set_save_note((select post_id from made), repeat('x', 501))$$,
  'P0001', 'note_too_long', 'notes are limited to 500 characters');

select pg_temp.act_as('00000000-0000-4000-8000-0000000000b1');
select is((select count(*)::int from public.saves where note is not null), 0, 'the author cannot read another person''s note');

select * from finish();
rollback;
