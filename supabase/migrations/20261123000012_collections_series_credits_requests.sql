-- Saved collections, series, post credits, before/after posts, message request decisions, push tokens.

-- ---------- Saved collections (private) ----------
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now()
);
create unique index collections_user_name_idx on public.collections (user_id, lower(name));
alter table public.collections enable row level security;
create policy collections_select_own on public.collections for select to authenticated
  using (user_id = (select auth.uid()));

create table public.collection_posts (
  collection_id uuid not null references public.collections (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, post_id)
);
create index collection_posts_user_idx on public.collection_posts (user_id, added_at desc);
alter table public.collection_posts enable row level security;
create policy collection_posts_select_own on public.collection_posts for select to authenticated
  using (user_id = (select auth.uid()));

create function public.create_collection(p_name text)
returns public.collections
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_row public.collections;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if char_length(v_name) not between 1 and 40 then raise exception 'invalid_name' using errcode = 'P0001'; end if;
  if (select count(*) from public.collections where user_id = v_uid) >= 50 then
    raise exception 'too_many_collections' using errcode = 'P0001';
  end if;
  insert into public.collections (user_id, name) values (v_uid, v_name) returning * into v_row;
  return v_row;
exception when unique_violation then
  raise exception 'name_taken' using errcode = 'P0001';
end $$;

-- Adds or removes a post in one of the caller's collections. Adding also saves the post.
create function public.set_collection_post(p_collection_id uuid, p_post_id uuid, p_in boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.collections c where c.id = p_collection_id and c.user_id = v_uid) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_in then
    if not exists (select 1 from public.posts p where p.id = p_post_id) then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    insert into public.saves (post_id, user_id) values (p_post_id, v_uid) on conflict do nothing;
    insert into public.collection_posts (collection_id, post_id, user_id) values (p_collection_id, p_post_id, v_uid)
      on conflict do nothing;
  else
    delete from public.collection_posts where collection_id = p_collection_id and post_id = p_post_id and user_id = v_uid;
  end if;
end $$;

create function public.delete_collection(p_collection_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  delete from public.collections where id = p_collection_id and user_id = auth.uid();
end $$;

-- ---------- Series ----------
create table public.series (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  created_at timestamptz not null default now()
);
create unique index series_author_title_idx on public.series (author_id, lower(title));
alter table public.series enable row level security;
create policy series_select on public.series for select to authenticated
  using (author_id = (select auth.uid()) or private.is_profile_visible(author_id, (select auth.uid())));

alter table public.posts add column series_id uuid references public.series (id) on delete set null;
create index posts_series_idx on public.posts (series_id, created_at) where series_id is not null;

create function public.create_series(p_title text)
returns public.series
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_row public.series;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if char_length(v_title) not between 1 and 60 then raise exception 'invalid_title' using errcode = 'P0001'; end if;
  if (select count(*) from public.series where author_id = v_uid) >= 50 then
    raise exception 'too_many_series' using errcode = 'P0001';
  end if;
  insert into public.series (author_id, title) values (v_uid, v_title) returning * into v_row;
  return v_row;
exception when unique_violation then
  raise exception 'name_taken' using errcode = 'P0001';
end $$;

-- Only the author can put their own post into their own series (or take it out with null).
create function public.set_post_series(p_post_id uuid, p_series_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_series_id is not null and not exists (select 1 from public.series s where s.id = p_series_id and s.author_id = v_uid) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  update public.posts set series_id = p_series_id where id = p_post_id and author_id = v_uid and deleted_at is null;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
end $$;

-- ---------- Credits (free text, author-managed) ----------
create table public.post_credits (
  post_id uuid not null references public.posts (id) on delete cascade,
  position smallint not null check (position between 0 and 4),
  role text not null check (char_length(role) between 1 and 30),
  name text not null check (char_length(name) between 1 and 60),
  primary key (post_id, position)
);
alter table public.post_credits enable row level security;
create policy post_credits_select on public.post_credits for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));

create function public.set_post_credits(p_post_id uuid, p_credits jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_item jsonb;
  v_i smallint := 0;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.posts p where p.id = p_post_id and p.author_id = v_uid and p.deleted_at is null) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if jsonb_typeof(coalesce(p_credits, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_credits, '[]'::jsonb)) > 5 then
    raise exception 'invalid_credits' using errcode = 'P0001';
  end if;
  delete from public.post_credits where post_id = p_post_id;
  for v_item in select * from jsonb_array_elements(coalesce(p_credits, '[]'::jsonb)) loop
    insert into public.post_credits (post_id, position, role, name)
    values (p_post_id, v_i, btrim(coalesce(v_item ->> 'role', '')), btrim(coalesce(v_item ->> 'name', '')));
    v_i := v_i + 1;
  end loop;
exception when check_violation then
  raise exception 'invalid_credits' using errcode = 'P0001';
end $$;

-- ---------- Before/after posts ----------
alter table public.posts add column is_compare boolean not null default false;

create function public.set_post_compare(p_post_id uuid, p_on boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_on and (select count(*) from public.post_media pm where pm.post_id = p_post_id) <> 2 then
    raise exception 'needs_two_images' using errcode = 'P0001';
  end if;
  update public.posts set is_compare = p_on where id = p_post_id and author_id = v_uid and deleted_at is null and kind in ('photo', 'carousel');
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
end $$;

-- ---------- Message request decisions ----------
create table public.message_request_decisions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  other_id uuid not null references public.profiles (id) on delete cascade,
  decision text not null check (decision in ('accepted', 'declined')),
  decided_at timestamptz not null default now(),
  primary key (user_id, other_id)
);
alter table public.message_request_decisions enable row level security;
create policy mrd_select_own on public.message_request_decisions for select to authenticated
  using (user_id = (select auth.uid()));

create function public.decide_message_request(p_other uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  insert into public.message_request_decisions (user_id, other_id, decision)
  values (v_uid, p_other, case when p_accept then 'accepted' else 'declined' end)
  on conflict (user_id, other_id) do update set decision = excluded.decision, decided_at = now();
end $$;

-- ---------- Push tokens (registration only; sending arrives with the API phase) ----------
create table public.push_tokens (
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null check (char_length(token) between 10 and 300),
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  primary key (user_id, token)
);
alter table public.push_tokens enable row level security;
create policy push_tokens_select_own on public.push_tokens for select to authenticated
  using (user_id = (select auth.uid()));

create function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  insert into public.push_tokens (user_id, token, platform) values (auth.uid(), p_token, p_platform)
  on conflict do nothing;
end $$;

-- ---------- Grants ----------
do $$
declare f text;
begin
  foreach f in array array[
    'create_collection(text)', 'set_collection_post(uuid,uuid,boolean)', 'delete_collection(uuid)',
    'create_series(text)', 'set_post_series(uuid,uuid)', 'set_post_credits(uuid,jsonb)',
    'set_post_compare(uuid,boolean)', 'decide_message_request(uuid,boolean)', 'register_push_token(text,text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- This project does not grant table access by default; reads are limited by the RLS policies above.
grant select on public.collections, public.collection_posts, public.series, public.post_credits, public.message_request_decisions to authenticated;
grant select (series_id, is_compare) on public.posts to authenticated;
