-- Find friends: "people you may know" from accounts followed by the people you follow.
create or replace function public.friend_suggestions(p_limit integer default 20)
returns table (user_id uuid, mutual_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select f2.followee_id as user_id, count(*)::integer as mutual_count
  from public.follows f1
  join public.follows f2 on f2.follower_id = f1.followee_id and f2.state = 'active'
  join public.profiles p on p.id = f2.followee_id and p.account_status = 'active'
  where f1.follower_id = auth.uid()
    and f1.state = 'active'
    and f2.followee_id <> auth.uid()
    and not exists (select 1 from public.follows x where x.follower_id = auth.uid() and x.followee_id = f2.followee_id)
    and not exists (select 1 from public.blocks b where (b.blocker_id = auth.uid() and b.blocked_id = f2.followee_id) or (b.blocker_id = f2.followee_id and b.blocked_id = auth.uid()))
    and not exists (select 1 from public.mutes m where m.muter_id = auth.uid() and m.muted_id = f2.followee_id)
  group by f2.followee_id
  order by count(*) desc, f2.followee_id
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;
revoke all on function public.friend_suggestions(integer) from public, anon;
grant execute on function public.friend_suggestions(integer) to authenticated;
