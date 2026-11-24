-- Tests for opt-in contact discovery.
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
  ('00000000-0000-4000-8000-000000000b01', 'Find_A@Test.invalid', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000b02', 'fc_b@test.invalid', now(), 'authenticated', 'authenticated');
insert into public.profiles (id, username, is_private) values
  ('00000000-0000-4000-8000-000000000b01', 'fc_a', false),
  ('00000000-0000-4000-8000-000000000b02', 'fc_b', false);

select pg_temp.act_as('00000000-0000-4000-8000-000000000b02');
select is((select count(*)::int from public.match_contacts(array[encode(sha256(convert_to('find_a@test.invalid', 'UTF8')), 'hex')])), 0, 'no match until the person opts in');
select pg_temp.act_as('00000000-0000-4000-8000-000000000b01');
select lives_ok($$select public.set_discoverable(true)$$, 'opt in');
select pg_temp.act_as('00000000-0000-4000-8000-000000000b02');
select is((select count(*)::int from public.match_contacts(array[encode(sha256(convert_to('find_a@test.invalid', 'UTF8')), 'hex')])), 1, 'matches after opt-in, ignoring case');
select is((select count(*)::int from public.contact_discovery), 0, 'others cannot read discovery rows');
select pg_temp.act_as('00000000-0000-4000-8000-000000000b01');
select public.set_discoverable(false);
select pg_temp.act_as('00000000-0000-4000-8000-000000000b02');
select is((select count(*)::int from public.match_contacts(array[encode(sha256(convert_to('find_a@test.invalid', 'UTF8')), 'hex')])), 0, 'no match after opting out');
select throws_ok($$select * from public.match_contacts((select array_agg(md5(g::text)) from generate_series(1, 1001) g))$$, 'P0001', 'too_many_contacts', 'more than 1000 hashes is refused');
select is((select count(*)::int from public.contact_lookups), 0, 'lookup log is not readable by clients');

select * from finish();
rollback;
