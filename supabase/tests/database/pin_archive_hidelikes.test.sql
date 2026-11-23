-- Tests for pinning, archiving and hiding like counts on posts.
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
  ('00000000-0000-4000-8000-0000000000d1', 'pa_a@test.invalid', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000d2', 'pa_b@test.invalid', now(), 'authenticated', 'authenticated');
insert into public.profiles (id, username, is_private) values
  ('00000000-0000-4000-8000-0000000000d1', 'pa_a', false),
  ('00000000-0000-4000-8000-0000000000d2', 'pa_b', false);
insert into public.profile_stats (user_id) values
  ('00000000-0000-4000-8000-0000000000d1'), ('00000000-0000-4000-8000-0000000000d2') on conflict do nothing;
insert into public.media_assets (id, owner_id, kind, status, storage_key, mime_type, width, height, bytes) values
  ('00000000-0000-4000-8000-0000000000a9', '00000000-0000-4000-8000-0000000000d1', 'image', 'ready', '00000000-0000-4000-8000-0000000000d1/a.jpg', 'image/jpeg', 100, 100, 1000);

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d1');
create temp table made (p uuid);
grant all on made to authenticated;
insert into made select id from public.publish_post('mine', array['00000000-0000-4000-8000-0000000000a9']::uuid[]);

select lives_ok(format($$select public.set_post_pinned(%L, true)$$, (select p from made)), 'author pins a post');
select lives_ok(format($$select public.set_post_hide_likes(%L, true)$$, (select p from made)), 'author hides the like count');
select lives_ok(format($$select public.set_post_archived(%L, true)$$, (select p from made)), 'author archives a post');
select is((select count(*)::int from public.posts where pinned_at is not null), 0, 'archiving unpins');

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d2');
select is((select count(*)::int from public.posts), 0, 'others cannot see an archived post');
select throws_ok(format($$select public.set_post_archived(%L, false)$$, (select p from made)), 'P0002', null, 'others cannot restore it');

select * from finish();
rollback;
