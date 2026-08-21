-- yoRento: admins could see every vehicle but had no way to remove
-- one — /admin/vehicles only offered status changes (publish/pause/
-- archive/restore), no delete. Same ON DELETE RESTRICT constraints
-- apply here as everywhere else (a vehicle with real booking/
-- verification history can't be hard-deleted, by design), so this
-- mirrors the host-facing delete endpoint: try a real delete, surface
-- a clear "has history" error via the FK violation if it's blocked.
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

  delete from public.vehicles where id = target_vehicle_id returning * into deleted_vehicle;
  if deleted_vehicle.id is null then raise exception 'VEHICLE_NOT_FOUND'; end if;

  insert into public.audit_logs (actor_user_id, event_type, target_type, target_id, metadata)
  values (auth.uid(), 'vehicle_deleted', 'vehicles', target_vehicle_id, jsonb_build_object('make', deleted_vehicle.make, 'model', deleted_vehicle.model, 'year', deleted_vehicle.year));

  return deleted_vehicle;
end;
$$;

revoke execute on function public.admin_delete_vehicle(uuid) from public;
grant execute on function public.admin_delete_vehicle(uuid) to authenticated;

-- The storage cleanup step (removing the deleted vehicle's photos)
-- runs as the admin through the normal RLS-bound client, same as
-- every other admin route in this app — no service-role client
-- needed, just widen the existing delete policy to admins too.
drop policy if exists "vehicle managers delete vehicle photos" on storage.objects;
create policy "vehicle managers delete vehicle photos" on storage.objects for delete using (
  bucket_id = 'vehicle-photos'
  and (public.can_manage_vehicle(((storage.foldername(name))[1])::uuid) or public.is_platform_admin())
);
