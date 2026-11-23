-- Tests for profile website/location, highlights and post tagging (consent).
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
  ('00000000-0000-4000-8000-0000000000e1', 'pe_a@test.invalid', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e2', 'pe_b@test.invalid', now(), 'authenticated', 'authenticated');
insert into public.profiles (id, username, is_private) values
  ('00000000-0000-4000-8000-0000000000e1', 'pe_a', false),
  ('00000000-0000-4000-8000-0000000000e2', 'pe_b', false);
insert into public.profile_stats (user_id) values
  ('00000000-0000-4000-8000-0000000000e1'), ('00000000-0000-4000-8000-0000000000e2') on conflict do nothing;
insert into public.media_assets (id, owner_id, kind, status, storage_key, mime_type, width, height, bytes) values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000e1', 'image', 'ready', '00000000-0000-4000-8000-0000000000e1/a.jpg', 'image/jpeg', 100, 100, 1000);
insert into public.stories (id, author_id, media_id, expires_at) values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000b1', now() + interval '1 day');

select pg_temp.act_as('00000000-0000-4000-8000-0000000000e1');
select throws_ok($$update public.profiles set website = 'http://evil.example' where id = '00000000-0000-4000-8000-0000000000e1'$$, '23514', null, 'website must be https');
select lives_ok($$update public.profiles set website = 'https://example.com/x', location = 'London' where id = '00000000-0000-4000-8000-0000000000e1'$$, 'valid website and location save');

create temp table made (h uuid, p uuid);
grant all on made to authenticated;
insert into made (h) select id from public.create_highlight('Trip', '00000000-0000-4000-8000-0000000000c1');
select is((select count(*)::int from public.highlight_items), 1, 'creating a highlight adds the story');

select pg_temp.act_as('00000000-0000-4000-8000-0000000000e2');
select throws_ok(format($$select public.remove_highlight_item(%L, '00000000-0000-4000-8000-0000000000b1')$$, (select h from made)), 'P0002', null, 'others cannot edit a highlight');

select pg_temp.act_as('00000000-0000-4000-8000-0000000000e1');
select lives_ok(format($$select public.remove_highlight_item(%L, '00000000-0000-4000-8000-0000000000b1')$$, (select h from made)), 'owner removes the last item');
select is((select count(*)::int from public.highlights), 0, 'an empty highlight is deleted');

update made set p = (select id from public.publish_post('mine', array['00000000-0000-4000-8000-0000000000b1']::uuid[]));
select throws_ok(format($$select public.tag_user(%L, '00000000-0000-4000-8000-0000000000e1')$$, (select p from made)), 'P0001', null, 'cannot tag yourself');
select lives_ok(format($$select public.tag_user(%L, '00000000-0000-4000-8000-0000000000e2')$$, (select p from made)), 'author tags someone (pending)');

select pg_temp.act_as('00000000-0000-4000-8000-0000000000e2');
select lives_ok(format($$select public.respond_tag(%L, false)$$, (select p from made)), 'tagged person can decline');

select * from finish();
rollback;
