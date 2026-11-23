-- Explore ranking, plus covering indexes the advisor flagged.
create index collection_posts_post_idx on public.collection_posts (post_id);
create index message_request_decisions_other_idx on public.message_request_decisions (other_id);

-- Ranked post ids for Explore. SECURITY INVOKER, so posts RLS (visibility, blocks, privacy) still applies.
-- Score favours engagement and decays with age; no more than two posts per author; own and muted authors are left out.
create function public.explore_posts(p_limit integer default 60)
returns table (post_id uuid)
language sql
stable
security invoker
set search_path = ''
as $$
  with candidates as (
    select
      p.id,
      p.author_id,
      (coalesce(s.like_count, 0) + 2 * coalesce(s.comment_count, 0) + 1)::float8
        / power(extract(epoch from (now() - p.created_at)) / 3600.0 + 2.0, 1.5) as score
    from public.posts p
    left join public.post_stats s on s.post_id = p.id
    where p.status = 'published'
      and p.deleted_at is null
      and p.author_id <> (select auth.uid())
      and p.created_at > now() - interval '30 days'
      and not exists (select 1 from public.mutes m where m.muter_id = (select auth.uid()) and m.muted_id = p.author_id)
  ), ranked as (
    select id, score, row_number() over (partition by author_id order by score desc) as author_rank
    from candidates
  )
  select id from ranked
  where author_rank <= 2
  order by score desc
  limit least(greatest(p_limit, 1), 100);
$$;

revoke all on function public.explore_posts(integer) from public, anon;
grant execute on function public.explore_posts(integer) to authenticated;
