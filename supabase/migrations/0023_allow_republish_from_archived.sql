-- yoRento: archiving a vehicle was documented (both to users and in
-- 0019's own commit message) as "hide it from search" — a reversible
-- pause, the same idea as 'paused'. But publish_vehicle's eligible
-- source-status list only included ('draft', 'pending_review',
-- 'paused') — 'archived' was missing, so trying to publish an archived
-- vehicle back always failed with VEHICLE_NOT_ELIGIBLE. The client also
-- didn't surface that error (fixed separately), so it looked like the
-- button just did nothing.
create or replace function public.publish_vehicle(target_vehicle_id uuid)
returns public.vehicles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_vehicle public.vehicles;
  is_verified boolean;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if exists (select 1 from public.profiles where id = auth.uid() and status <> 'active') then
    raise exception 'ACCOUNT_SUSPENDED';
  end if;
  if not public.can_manage_vehicle_privileged(target_vehicle_id) then raise exception 'VEHICLE_ACCESS_DENIED'; end if;

  select exists (
    select 1 from public.verification_records
    where vehicle_id = target_vehicle_id and verification_type = 'vehicle' and status = 'verified'
  ) into is_verified;
  if not is_verified then raise exception 'VEHICLE_NOT_VERIFIED'; end if;

  update public.vehicles set status = 'published', updated_at = now()
  where id = target_vehicle_id and status in ('draft', 'pending_review', 'paused', 'archived')
  returning * into updated_vehicle;

  if updated_vehicle.id is null then raise exception 'VEHICLE_NOT_ELIGIBLE'; end if;
  return updated_vehicle;
end;
$$;
