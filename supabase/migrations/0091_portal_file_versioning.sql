-- =============================================================================
-- 0091_portal_file_versioning.sql
--
-- Adds file versioning to portal_files for professional document management.
-- Clients can see revision history; freelancers can upload new versions.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. portal_file_versions — version history for portal files
-- ---------------------------------------------------------------------------
-- Each file can have multiple versions. The "current" version is the latest
-- non-deleted row in portal_files. Previous versions are stored here with
-- full metadata for audit trail and rollback capability.
create table if not exists public.portal_file_versions (
  id              uuid primary key default gen_random_uuid(),
  file_id         uuid not null references public.portal_files(id) on delete cascade,
  version_number  int not null,
  r2_key          text not null,
  name            text not null,
  size_bytes      bigint not null check (size_bytes >= 0),
  mime_type       text not null,
  uploaded_by     uuid not null references auth.users(id) on delete cascade,
  changelog       text check (char_length(changelog) <= 2000),
  created_at      timestamptz not null default now()
);

create index if not exists portal_file_versions_file_idx
  on public.portal_file_versions (file_id, version_number desc);

create unique index if not exists portal_file_versions_unique_version
  on public.portal_file_versions (file_id, version_number);

-- ---------------------------------------------------------------------------
-- 2. Add version tracking columns to portal_files
-- ---------------------------------------------------------------------------
alter table public.portal_files
  add column if not exists current_version int not null default 1;

alter table public.portal_files
  add column if not exists previous_r2_key text;

-- ---------------------------------------------------------------------------
-- 3. Trigger: auto-create version on file update
-- ---------------------------------------------------------------------------
create or replace function public.portal_file_version_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version int;
begin
  -- Only create version when r2_key changes (new file uploaded)
  if (tg_op = 'UPDATE') and (old.r2_key is distinct from new.r2_key) then
    -- Store old file as a version
    v_version := coalesce(old.current_version, 1);
    
    insert into public.portal_file_versions (
      file_id, version_number, r2_key, name, size_bytes, mime_type, uploaded_by, changelog
    ) values (
      old.id,
      v_version,
      old.r2_key,
      old.name,
      old.size_bytes,
      old.mime_type,
      old.uploaded_by,
      'Version ' || v_version || ' - ' || coalesce(new.name, old.name)
    );
    
    -- Update current file with new version number and previous key
    new.current_version := v_version + 1;
    new.previous_r2_key := old.r2_key;
    new.uploaded_by := new.uploaded_by; -- track who uploaded the new version
  end if;
  
  return new;
end
$$;

drop trigger if exists portal_file_version_sync_trg on public.portal_files;
create trigger portal_file_version_sync_trg
before update of r2_key on public.portal_files
for each row execute function public.portal_file_version_sync();

-- ---------------------------------------------------------------------------
-- 4. RLS — portal_file_versions
-- ---------------------------------------------------------------------------
alter table public.portal_file_versions enable row level security;

-- Owner of the portal can read all versions
drop policy if exists portal_file_versions_owner_read on public.portal_file_versions;
create policy portal_file_versions_owner_read
  on public.portal_file_versions
  for select
  using (
    exists (
      select 1 from public.portal_files pf
      join public.portals p on p.id = pf.portal_id
      where pf.id = portal_file_versions.file_id
        and p.owner_user_id = auth.uid()
        and p.deleted_at is null
    )
  );

-- Active portal member can read all versions
drop policy if exists portal_file_versions_member_read on public.portal_file_versions;
create policy portal_file_versions_member_read
  on public.portal_file_versions
  for select
  using (
    exists (
      select 1 from public.portal_files pf
      join public.portal_members pm on pm.portal_id = pf.portal_id
      where pf.id = portal_file_versions.file_id
        and pm.user_id = auth.uid()
        and pm.revoked_at is null
        and pf.deleted_at is null
    )
  );

-- Only owner can insert versions (via trigger, but explicit for clarity)
drop policy if exists portal_file_versions_owner_insert on public.portal_file_versions;
create policy portal_file_versions_owner_insert
  on public.portal_file_versions
  for insert
  with check (
    exists (
      select 1 from public.portal_files pf
      join public.portals p on p.id = pf.portal_id
      where pf.id = portal_file_versions.file_id
        and p.owner_user_id = auth.uid()
        and p.deleted_at is null
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Activity logging for version events
-- ---------------------------------------------------------------------------
-- The existing portal_activity table already logs file.uploaded
-- We extend it to also log file.version_created with version metadata
-- (No schema change needed - payload JSON can hold version info)

-- ---------------------------------------------------------------------------
-- 6. Backfill: set current_version = 1 for existing files
-- ---------------------------------------------------------------------------
update public.portal_files
set current_version = 1
where current_version is null;