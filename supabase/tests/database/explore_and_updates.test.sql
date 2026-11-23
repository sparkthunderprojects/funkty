-- Tests for Explore ranking and post updates.
-- Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('00000000-0000-4000-8000-0000000000f1', 'ex_a@test.invalid', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f2', 'ex_b@test.invalid', now(), 'authenticated', 'authenticated');
insert into public.profiles (id, username, is_private) values
  ('00000000-0000-4000-8000-0000000000f1', 'ex_a', false),
  ('00000000-0000-4000-8000-0000000000f2', 'ex_b', false);
insert into public.profile_stats (user_id) values
  ('00000000-0000-4000-8000-0000000000f1'), ('00000000-0000-4000-8000-0000000000f2') on conflict do nothing;
insert into public.media_assets (id, owner_id, kind, status, storage_key, mime_type, width, height, bytes) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000f1', 'image', 'ready', '00000000-0000-4000-8000-0000000000f1/a.jpg', 'image/jpeg', 100, 100, 1000),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000f2', 'image', 'ready', '00000000-0000-4000-8000-0000000000f2/a.jpg', 'image/jpeg', 100, 100, 1000);

select pg_temp.act_as('00000000-0000-4000-8000-0000000000f1');
create temp table made (a uuid, b uuid, upd uuid);
grant all on made to authenticated;
insert into made (a) select id from public.publish_post('mine', array['00000000-0000-4000-8000-0000000000a1']::uuid[]);
select pg_temp.act_as('00000000-0000-4000-8000-0000000000f2');
update made set b = (select id from public.publish_post('theirs', array['00000000-0000-4000-8000-0000000000a2']::uuid[]));

select pg_temp.act_as('00000000-0000-4000-8000-0000000000f1');
select ok((select count(*) from public.explore_posts(60) e where e.post_id = (select b from made)) = 1, 'explore includes other people''s posts');
select is((select count(*)::int from public.explore_posts(60) e where e.post_id = (select a from made)), 0, 'explore leaves out your own posts');
update made set upd = (public.add_post_update((select a from made), '  Finished!  ')).id;
select is((select body from public.post_updates where id = (select upd from made)), 'Finished!', 'author adds a trimmed update');
select throws_ok($$select public.add_post_update((select a from made), '')$$, 'invalid_body', 'empty update is rejected');
select throws_ok($$select public.add_post_update((select b from made), 'x')$$, 'not_found', 'cannot update someone else''s post');

select pg_temp.act_as('00000000-0000-4000-8000-0000000000f2');
select is((select count(*)::int from public.post_updates where id = (select upd from made)), 1, 'others can read updates on visible posts');
select lives_ok($$select public.delete_post_update((select upd from made))$$, 'deleting someone else''s update is a silent no-op');

select * from finish();
rollback;
