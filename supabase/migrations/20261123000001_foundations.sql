-- Foundations: extensions, private schema, id generator, shared helpers, outbox.
-- Security posture: new tables and functions in public get NO privileges for anon or
-- authenticated until a migration grants them explicitly (default deny at privilege level).

create extension if not exists citext with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

-- UUIDv7: time-ordered ids (48-bit millisecond timestamp + random). Keeps indexes compact
-- and makes keyset pagination by id equal to pagination by time.
create or replace function private.uuidv7()
returns uuid
language sql
volatile
parallel safe
set search_path = ''
as $$
  select encode(
    set_bit(
      set_bit(
        overlay(
          uuid_send(gen_random_uuid())
          placing substring(int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint) from 3)
          from 1 for 6
        ),
        52, 1
      ),
      53, 1
    ),
    'hex'
  )::uuid;
$$;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Outbox: written in the same transaction as the change; a worker relays events to the queue.
-- Only the service role and the database owner can read or write it.
create table public.outbox_events (
  id uuid primary key default private.uuidv7(),
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index outbox_events_unprocessed_idx on public.outbox_events (id) where processed_at is null;
alter table public.outbox_events enable row level security;
revoke all on public.outbox_events from anon, authenticated;

create or replace function private.emit_event(p_type text, p_payload jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.outbox_events (type, payload) values (p_type, p_payload);
$$;
