-- Covering indexes for foreign keys flagged by the performance advisor. These keep deletes and
-- joins on the referenced tables from scanning the referencing table.
create index appeals_user_idx on public.appeals (user_id);
create index appeals_decided_by_idx on public.appeals (decided_by) where decided_by is not null;
create index restrictions_created_by_idx on public.restrictions (created_by) where created_by is not null;
create index restrictions_policy_idx on public.restrictions (policy_id);
create index profiles_avatar_media_idx on public.profiles (avatar_media_id) where avatar_media_id is not null;
