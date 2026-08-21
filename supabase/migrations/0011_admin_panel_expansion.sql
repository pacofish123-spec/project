-- yoRento: backend for the expanded admin panel — in-app capability
-- grant/revoke (replacing the SQL-only process from 0004/0010), and an
-- admin override for vehicle listing status, following the same
-- security-definer + audit_logs pattern as admin_set_booking_status.

create or replace function public.admin_grant_capability(
  target_user_id uuid,
  capability_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then raise exception 'ADMIN_ACCESS_REQUIRED'; end if;

  insert into public.user_capabilities (user_id, capability, granted_by)
  values (target_user_id, capability_name, auth.uid())
  on conflict (user_id, capability) do nothing;

  insert into public.audit_logs (actor_user_id, event_type, target_type, target_id, metadata)
  values (auth.uid(), 'capability_granted', 'user_capabilities', target_user_id, jsonb_build_object('capability', capability_name));
end;
$$;

grant execute on function public.admin_grant_capability(uuid, text) to authenticated;

create or replace function public.admin_revoke_capability(
  target_user_id uuid,
  capability_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining_admins integer;
begin
  if not public.is_platform_admin() then raise exception 'ADMIN_ACCESS_REQUIRED'; end if;

  -- Never let the last platform admin be removed, whether that's an
  -- admin revoking their own access or (in a multi-admin future)
  -- revoking someone else's — the panel to undo this lives behind the
  -- very capability being revoked, so this must not become a lockout.
  if capability_name = 'can_manage_platform' then
    select count(*) into remaining_admins from public.user_capabilities where capability = 'can_manage_platform';
    if remaining_admins <= 1 then raise exception 'CANNOT_REMOVE_LAST_ADMIN'; end if;
  end if;

  delete from public.user_capabilities where user_id = target_user_id and capability = capability_name;

  insert into public.audit_logs (actor_user_id, event_type, target_type, target_id, metadata)
  values (auth.uid(), 'capability_revoked', 'user_capabilities', target_user_id, jsonb_build_object('capability', capability_name));
end;
$$;

grant execute on function public.admin_revoke_capability(uuid, text) to authenticated;

create or replace function public.admin_set_vehicle_status(
  target_vehicle_id uuid,
  new_status text
)
returns public.vehicles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_vehicle public.vehicles;
begin
  if not public.is_platform_admin() then raise exception 'ADMIN_ACCESS_REQUIRED'; end if;

  update public.vehicles
  set status = new_status, updated_at = now()
  where id = target_vehicle_id
  returning * into updated_vehicle;

  if updated_vehicle.id is null then raise exception 'VEHICLE_NOT_FOUND'; end if;

  insert into public.audit_logs (actor_user_id, event_type, target_type, target_id, metadata)
  values (auth.uid(), 'vehicle_status_overridden', 'vehicles', target_vehicle_id, jsonb_build_object('new_status', new_status));

  return updated_vehicle;
end;
$$;

grant execute on function public.admin_set_vehicle_status(uuid, text) to authenticated;

-- Admin-only visibility for the new Vehicles and Businesses panels —
-- the marketplace's existing "published only" read policy on vehicles
-- is fine for the public site but too narrow for admin moderation
-- (drafts, paused, archived listings need to be visible too).
drop policy if exists "platform admins read all vehicles" on public.vehicles;
create policy "platform admins read all vehicles" on public.vehicles for select using (public.is_platform_admin());

drop policy if exists "platform admins read all business members" on public.business_members;
create policy "platform admins read all business members" on public.business_members for select using (public.is_platform_admin());
