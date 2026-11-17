-- =============================================================================
-- 0099_org_auto_create.sql
-- Auto-create personal organization on user signup
-- =============================================================================

-- Update the handle_new_auth_user function to also create personal organization
-- This replaces the version from 0030_auth_trigger_fix.sql

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_full_name text := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'User'
  );
begin
  -- Create/update user profile
  begin
    insert into public.user_profiles (id, full_name, email)
    values (new.id, v_full_name, new.email)
    on conflict (id) do update
      set
        full_name = coalesce(excluded.full_name, public.user_profiles.full_name),
        email = excluded.email,
        updated_at = now();

  exception
    when unique_violation then
      -- The email column has a separate UNIQUE constraint.
      -- If a stale profile row exists for the same email, attach it to the new
      -- auth user. Guard against the rare case where this id already has a
      -- profile too; in that case, keep the id-owned profile and avoid blocking
      -- signup.
      begin
        update public.user_profiles
          set
            id = new.id,
            full_name = coalesce(v_full_name, full_name),
            updated_at = now()
        where email = new.email
          and not exists (
            select 1
            from public.user_profiles existing
            where existing.id = new.id
          );

        if not found then
          update public.user_profiles
            set
              full_name = coalesce(v_full_name, full_name),
              updated_at = now()
          where id = new.id;
        end if;

      exception
        when others then
          raise warning 'handle_new_auth_user: could not repair profile for user % (%): %',
            new.id, new.email, sqlerrm;
      end;

    when others then
      raise warning 'handle_new_auth_user: could not create profile for user % (%): %',
        new.id, new.email, sqlerrm;
  end;

  -- Keep feature-gating safe even when the profile path repaired an existing
  -- row instead of inserting a new one.
  begin
    insert into public.subscriptions (user_id, plan, status)
    values (new.id, 'free', 'active')
    on conflict (user_id) do nothing;

  exception
    when undefined_table then
      -- Defensive for partial/local databases. In the normal migration order,
      -- subscriptions exists by the time this migration runs.
      null;
    when others then
      raise warning 'handle_new_auth_user: could not provision subscription for user % (%): %',
        new.id, new.email, sqlerrm;
  end;

  -- Auto-create personal organization for the new user
  begin
    perform public.create_personal_organization(new);
  exception
    when undefined_function then
      -- Function may not exist yet in some migration orders
      null;
    when others then
      raise warning 'handle_new_auth_user: could not create personal org for user % (%): %',
        new.id, new.email, sqlerrm;
  end;

  return new;
end $$;

-- Ensure the trigger exists (idempotent)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();