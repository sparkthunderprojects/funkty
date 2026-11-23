-- Private notes on saved posts: only the saver can read or write them.
alter table public.saves add column if not exists note text;
alter table public.saves drop constraint if exists saves_note_length;
alter table public.saves add constraint saves_note_length check (note is null or char_length(note) <= 500);

create or replace function public.set_save_note(p_post_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'note too long';
  end if;
  update public.saves set note = v_note where post_id = p_post_id and user_id = auth.uid();
  if not found then
    raise exception 'save the post before adding a note';
  end if;
end;
$$;

revoke all on function public.set_save_note(uuid, text) from public, anon;
grant execute on function public.set_save_note(uuid, text) to authenticated;
