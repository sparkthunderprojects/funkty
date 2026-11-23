-- Moderation core: policy library, reports, restrictions with mandatory reasons, appeals,
-- append-only audit log. Transparency is enforced by the data model: a restriction cannot be
-- stored without a policy reference and a user-facing reason, and users can read every
-- restriction that affects them.

create table public.policies (
  id uuid primary key default private.uuidv7(),
  code text not null unique,
  title text not null,
  summary text not null,
  version integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- DRAFT text. Replace with the legally reviewed policies before public launch.
insert into public.policies (code, title, summary) values
  ('spam', 'Spam and platform manipulation', 'No fake engagement, mass unsolicited messages or deceptive links.'),
  ('harassment', 'Bullying and harassment', 'No abuse, threats or unwanted contact aimed at a person.'),
  ('hate_speech', 'Hate speech', 'No attacks on people based on protected characteristics.'),
  ('violence', 'Violence and dangerous organisations', 'No credible threats, glorification of violence or support for terrorism.'),
  ('nudity_sexual', 'Nudity and sexual content', 'Limits on nudity and sexual content; none involving minors.'),
  ('child_safety', 'Child safety', 'Zero tolerance for sexual exploitation or endangerment of minors.'),
  ('self_harm', 'Suicide, self-harm and eating disorders', 'No content that promotes or encourages self-harm.'),
  ('illegal_goods', 'Illegal goods and services', 'No sale or promotion of illegal goods or services.'),
  ('impersonation', 'Impersonation and fake accounts', 'No pretending to be another person or organisation.'),
  ('intellectual_property', 'Intellectual property', 'No posting content that infringes others'' rights.'),
  ('privacy', 'Privacy and personal information', 'No sharing private information about others without consent.'),
  ('misinformation', 'Harmful misinformation', 'No false content likely to cause serious real-world harm.'),
  ('terms_of_service', 'Terms of Service', 'Any other breach of the Funkty Terms of Service.');

create table public.staff_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('moderator', 'senior_moderator', 'admin')),
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default private.uuidv7(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('profile', 'post', 'comment', 'message', 'story')),
  target_id uuid not null,
  reason_code text not null,
  details text check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'in_review', 'actioned', 'dismissed')),
  created_at timestamptz not null default now()
);
create unique index reports_one_open_per_target on public.reports (reporter_id, target_type, target_id)
  where status in ('open', 'in_review');
create index reports_queue_idx on public.reports (status, created_at);
create index reports_target_idx on public.reports (target_type, target_id);
create index reports_reporter_idx on public.reports (reporter_id, created_at desc);

create table public.restrictions (
  id uuid primary key default private.uuidv7(),
  target_type text not null check (target_type in ('account', 'post', 'comment', 'message', 'story')),
  target_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in (
    'label', 'reduced_distribution', 'age_restriction', 'removal',
    'feature_limit', 'suspension', 'ban', 'legal_removal'
  )),
  feature text check (feature in ('post', 'comment', 'message', 'follow', 'like')),
  policy_id uuid not null references public.policies (id),
  reason_text text not null check (char_length(btrim(reason_text)) >= 10),
  legal_basis text,
  automated boolean not null default false,
  status text not null default 'active' check (status in ('active', 'lifted', 'expired', 'overturned')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  constraint restrictions_feature_required check (kind <> 'feature_limit' or feature is not null),
  constraint restrictions_legal_basis_required check (kind <> 'legal_removal' or legal_basis is not null),
  constraint restrictions_end_after_start check (ends_at is null or ends_at > starts_at)
);
create index restrictions_user_idx on public.restrictions (user_id, status);
create index restrictions_target_idx on public.restrictions (target_type, target_id);

create table public.appeals (
  id uuid primary key default private.uuidv7(),
  restriction_id uuid not null unique references public.restrictions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 10 and 2000),
  status text not null default 'open' check (status in ('open', 'upheld', 'overturned')),
  decided_by uuid references auth.users (id),
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);
create index appeals_queue_idx on public.appeals (status, created_at);

create table public.audit_log (
  id uuid primary key default private.uuidv7(),
  actor_id uuid,
  actor_role text,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_target_idx on public.audit_log (target_type, target_id);
create index audit_log_actor_idx on public.audit_log (actor_id, created_at desc);

create or replace function private.audit_log_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_log_is_append_only' using errcode = 'P0001';
end;
$$;
create trigger audit_log_no_update before update or delete on public.audit_log
  for each row execute function private.audit_log_immutable();
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function private.audit_log_immutable();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.staff_roles where user_id = auth.uid());
$$;

-- May this user perform an action right now? False when the account is not active or
-- restricted, or when a suspension, ban or matching feature limit is in force.
create or replace function private.is_action_allowed(p_user uuid, p_feature text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1 from public.profiles p
      where p.id = p_user and p.account_status in ('active', 'restricted')
    )
    and not exists (
      select 1 from public.restrictions r
      where r.user_id = p_user
        and r.status = 'active'
        and r.starts_at <= now()
        and (r.ends_at is null or r.ends_at > now())
        and (r.kind in ('suspension', 'ban') or (r.kind = 'feature_limit' and r.feature = p_feature))
    );
$$;

grant execute on function private.is_staff() to authenticated, service_role;
grant execute on function private.is_action_allowed(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security and privileges
-- ---------------------------------------------------------------------------

alter table public.policies enable row level security;
alter table public.staff_roles enable row level security;
alter table public.reports enable row level security;
alter table public.restrictions enable row level security;
alter table public.appeals enable row level security;
alter table public.audit_log enable row level security;

create policy policies_select_active on public.policies for select to anon, authenticated
  using (is_active);
create policy reports_select_own on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()));
-- Users read every restriction that affects them: what, why, under which policy, until when.
create policy restrictions_select_own on public.restrictions for select to authenticated
  using (user_id = (select auth.uid()));
create policy appeals_select_own on public.appeals for select to authenticated
  using (user_id = (select auth.uid()));

grant select on public.policies to anon, authenticated;
grant select on public.reports, public.restrictions, public.appeals to authenticated;
revoke all on public.staff_roles, public.audit_log from anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC functions
-- ---------------------------------------------------------------------------

create or replace function public.report_content(
  p_target_type text,
  p_target_id uuid,
  p_reason_code text,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_target_type not in ('profile', 'post', 'comment', 'message', 'story') then
    raise exception 'invalid_target_type' using errcode = 'P0001';
  end if;
  if p_reason_code <> 'other'
     and not exists (select 1 from public.policies where code = p_reason_code and is_active) then
    raise exception 'invalid_reason' using errcode = 'P0001';
  end if;
  if p_details is not null and char_length(p_details) > 1000 then
    raise exception 'details_too_long' using errcode = 'P0001';
  end if;
  if (select count(*) from public.reports
      where reporter_id = v_uid and created_at > now() - interval '24 hours') >= 50 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.reports (reporter_id, target_type, target_id, reason_code, details)
  values (v_uid, p_target_type, p_target_id, p_reason_code, nullif(btrim(p_details), ''))
  on conflict (reporter_id, target_type, target_id) where status in ('open', 'in_review')
  do nothing
  returning id into v_id;

  if v_id is null then
    select r.id into v_id from public.reports r
    where r.reporter_id = v_uid and r.target_type = p_target_type and r.target_id = p_target_id
      and r.status in ('open', 'in_review');
    return v_id;
  end if;

  perform private.emit_event(
    'report.created',
    jsonb_build_object('report_id', v_id, 'target_type', p_target_type, 'target_id', p_target_id)
  );
  return v_id;
end;
$$;
grant execute on function public.report_content(text, uuid, text, text) to authenticated;

create or replace function public.appeal_restriction(p_restriction uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.restrictions r
    where r.id = p_restriction and r.user_id = v_uid and r.status in ('active', 'expired', 'lifted')
  ) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.appeals a where a.restriction_id = p_restriction) then
    raise exception 'already_appealed' using errcode = 'P0001';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 10 and 2000 then
    raise exception 'invalid_appeal_body' using errcode = 'P0001';
  end if;

  insert into public.appeals (restriction_id, user_id, body)
  values (p_restriction, v_uid, btrim(p_body))
  returning id into v_id;

  perform private.emit_event(
    'appeal.created', jsonb_build_object('appeal_id', v_id, 'restriction_id', p_restriction)
  );
  return v_id;
end;
$$;
grant execute on function public.appeal_restriction(uuid, text) to authenticated;
