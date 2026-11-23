-- Dated update notes an author adds to their own post. Readable by anyone who can see the post.
create table public.post_updates (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index post_updates_post_idx on public.post_updates (post_id, created_at);
alter table public.post_updates enable row level security;
create policy post_updates_select on public.post_updates for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
grant select on public.post_updates to authenticated;

create function public.add_post_update(p_post_id uuid, p_body text)
returns public.post_updates
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_body text := btrim(coalesce(p_body, ''));
  v_row public.post_updates;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.posts p where p.id = p_post_id and p.author_id = v_uid and p.deleted_at is null) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if char_length(v_body) not between 1 and 500 then raise exception 'invalid_body' using errcode = 'P0001'; end if;
  if (select count(*) from public.post_updates where post_id = p_post_id) >= 10 then
    raise exception 'too_many_updates' using errcode = 'P0001';
  end if;
  if not private.is_action_allowed(v_uid, 'post') then raise exception 'action_restricted' using errcode = 'P0001'; end if;
  insert into public.post_updates (post_id, body) values (p_post_id, v_body) returning * into v_row;
  return v_row;
end $$;

create function public.delete_post_update(p_update_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  delete from public.post_updates u using public.posts p
  where u.id = p_update_id and p.id = u.post_id and p.author_id = auth.uid();
end $$;

revoke all on function public.add_post_update(uuid, text) from public, anon;
revoke all on function public.delete_post_update(uuid) from public, anon;
grant execute on function public.add_post_update(uuid, text) to authenticated;
grant execute on function public.delete_post_update(uuid) to authenticated;
