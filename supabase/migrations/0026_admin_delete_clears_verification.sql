-- yoRento: admin_delete_vehicle was hitting ON DELETE RESTRICT on
-- verification_records for the extremely common case of a test/
-- unwanted vehicle that had gone through the (now-automatic)
-- verification flow — every draft that ever got photos added now has
-- a verification_records row, so this was blocking the ordinary case,
-- not just a genuine "has real history" case.
--
-- Distinguish by what the record actually represents: a booking is a
-- renter's real transaction, a review is another user's authored
-- content — neither should ever silently disappear, even for an
-- admin. A verification_records row is purely an internal review
-- artifact the platform itself created and the admin already has full
-- authority over (admin_review_verification approves/rejects it
-- directly) — safe to clear as part of an admin-authorized delete.
-- bookings/reviews stay untouched, so those still correctly block
-- deletion via the same RESTRICT constraint as before.
create or replace function public.admin_delete_vehicle(target_vehicle_id uuid)
returns public.vehicles
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_vehicle public.vehicles;
begin
  if not public.is_platform_admin() then raise exception 'ADMIN_ACCESS_REQUIRED'; end if;

  delete from public.verification_records where vehicle_id = target_vehicle_id;

  delete from public.vehicles where id = target_vehicle_id returning * into deleted_vehicle;
  if deleted_vehicle.id is null then raise exception 'VEHICLE_NOT_FOUND'; end if;

  insert into public.audit_logs (actor_user_id, event_type, target_type, target_id, metadata)
  values (auth.uid(), 'vehicle_deleted', 'vehicles', target_vehicle_id, jsonb_build_object('make', deleted_vehicle.make, 'model', deleted_vehicle.model, 'year', deleted_vehicle.year));

  return deleted_vehicle;
end;
$$;

-- Same problem hits hosts deleting their own vehicle: the RLS-bound
-- client the host-facing DELETE route used had no policy allowing it
-- to delete verification_records at all (only SELECT policies exist
-- on that table), so a host's own draft — now almost always carrying
-- a verification_records row thanks to the automatic request-on-
-- photos-added flow — could never be deleted even though they own
-- both rows. New RPC mirrors admin_delete_vehicle but checks
-- ownership (can_manage_vehicle) instead of platform-admin.
create or replace function public.delete_vehicle(target_vehicle_id uuid)
returns public.vehicles
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_vehicle public.vehicles;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not public.can_manage_vehicle(target_vehicle_id) then raise exception 'VEHICLE_ACCESS_DENIED'; end if;

  delete from public.verification_records where vehicle_id = target_vehicle_id;

  delete from public.vehicles where id = target_vehicle_id returning * into deleted_vehicle;
  if deleted_vehicle.id is null then raise exception 'VEHICLE_NOT_FOUND'; end if;

  return deleted_vehicle;
end;
$$;

revoke execute on function public.delete_vehicle(uuid) from public;
grant execute on function public.delete_vehicle(uuid) to authenticated;
