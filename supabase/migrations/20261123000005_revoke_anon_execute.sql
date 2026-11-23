-- Postgres grants EXECUTE on new functions to PUBLIC by default. Our public-schema RPCs are
-- SECURITY DEFINER, so signed-out callers must not be able to reach them. Only signed-in users
-- may call them, except username_available which the signup form needs before an account exists.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end
$$;

grant execute on function public.username_available(text) to anon;
