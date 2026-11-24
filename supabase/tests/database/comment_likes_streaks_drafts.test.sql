-- Tests for comment likes, posting streaks, drafts and scheduled posts.
-- Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('00000000-0000-4000-8000-0000000000a1', 'dr_a@test.invalid', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000a2', 'dr_b@test.invalid', now(), 'authenticated', 'authenticated');
insert into public.profiles (id, username, is_private) values
  ('00000000-0000-4000-8000-0000000000a1', 'dr_a', false),
  ('00000000-0000-4000-8000-0000000000a2', 'dr_b', false);
insert into public.profile_stats (user_id) values
  ('00000000-0000-4000-8000-0000000000a1'), ('00000000-0000-4000-8000-0000000000a2') on conflict do nothing;
insert into public.media_assets (id, owner_id, kind, status, storage_key, mime_type, width, height, bytes) values
  ('00000000-0000-4000-8000-0000000000a8', '00000000-0000-4000-8000-0000000000a1', 'image', 'ready', '00000000-0000-4000-8000-0000000000a1/a.jpg', 'image/jpeg', 100, 100, 1000),
  ('00000000-0000-4000-8000-0000000000a7', '00000000-0000-4000-8000-0000000000a1', 'image', 'ready', '00000000-0000-4000-8000-0000000000a1/b.jpg', 'image/jpeg', 100, 100, 1000);

select pg_temp.act_as('00000000-0000-4000-8000-0000000000a1');
select throws_ok($$select public.save_draft('late', array['00000000-0000-4000-8000-0000000000a8']::uuid[], null, false, now() - interval '1 day')$$, 'P0001', null, 'cannot schedule in the past');
select lives_ok($$select public.save_draft('later', array['00000000-0000-4000-8000-0000000000a8']::uuid[], null, false, now() + interval '2 hours')$$, 'schedule a post');
select is((select count(*)::int from public.post_drafts where status = 'scheduled'), 1, 'it is scheduled');
create temp table pub (id uuid);
grant all on pub to authenticated;
insert into pub select id from public.publish_draft((select id from public.save_draft('now', array['00000000-0000-4000-8000-0000000000a7']::uuid[])));
select is((select count(*)::int from public.posts where caption = 'now'), 1, 'publish a draft now');
select ok((select current_streak from public.posting_streak()) >= 1, 'posting starts a streak');

select pg_temp.act_as('00000000-0000-4000-8000-0000000000a2');
select is((select count(*)::int from public.post_drafts), 0, 'others cannot read my drafts');
select throws_ok(format($$select public.like_comment(%L)$$, gen_random_uuid()), 'P0002', null, 'cannot like a comment that does not exist');
select is((select count(*)::int from public.comment_like_counts(array[gen_random_uuid()])), 0, 'no counts for unknown comments');

select * from finish();
rollback;
