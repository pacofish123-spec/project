-- yoRento: two real gaps in the verification loop —
-- 1. Requesting verification never told anyone on the platform side.
--    The only way to know a request existed was to browse into
--    /admin/verification and look — no notification bell activity,
--    nothing on the admin's own homepage. Every platform admin now
--    gets a real notification the moment a vehicle verification is
--    requested.
-- 2. Approving a verification never moved the vehicle itself — the
--    host still had to separately visit their vehicle list and click
--    Publish. Since a vehicle verification request only ever exists to
--    gate publishing (see 0003's note this same block already carries:
--    "publish_vehicle is now reachable end-to-end once a record is
--    verified"), approving one should finish the job.

create or replace function public.request_vehicle_verification(target_vehicle_id uuid)
returns public.verification_records
language plpgsql
security definer
set search_path = public
as $$
declare
  created_record public.verification_records;
  target_vehicle public.vehicles;
  admin_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not public.can_manage_vehicle(target_vehicle_id) then raise exception 'VEHICLE_ACCESS_DENIED'; end if;

  if exists (
    select 1 from public.verification_records
    where vehicle_id = target_vehicle_id and verification_type = 'vehicle' and status in ('pending', 'in_review', 'verified')
  ) then
    raise exception 'VERIFICATION_ALREADY_REQUESTED';
  end if;

  insert into public.verification_records (user_id, vehicle_id, verification_type, status)
  values (auth.uid(), target_vehicle_id, 'vehicle', 'pending')
  returning * into created_record;

  select * into target_vehicle from public.vehicles where id = target_vehicle_id;

  for admin_id in select user_id from public.user_capabilities where capability = 'can_manage_platform' loop
    perform public.notify(
      admin_id,
      'vehicle_verification_requested',
      'New vehicle verification request',
      coalesce(target_vehicle.make || ' ' || target_vehicle.model || ' ' || target_vehicle.year::text, 'A vehicle'),
      '/admin/verification'
    );
  end loop;

  return created_record;
end;
$$;

create or replace function public.admin_review_verification(
  record_id uuid,
  new_status public.verification_status,
  note text default null
)
returns public.verification_records
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_record public.verification_records;
  auto_published boolean := false;
  updated_rows integer;
begin
  if not public.is_platform_admin() then raise exception 'ADMIN_ACCESS_REQUIRED'; end if;
  if new_status not in ('verified', 'failed', 'requires_information', 'in_review') then
    raise exception 'INVALID_STATUS';
  end if;

  update public.verification_records
  set status = new_status, updated_at = now()
  where id = record_id
  returning * into updated_record;

  if updated_record.id is null then raise exception 'RECORD_NOT_FOUND'; end if;

  insert into public.audit_logs (actor_user_id, event_type, target_type, target_id, metadata)
  values (auth.uid(), 'verification_reviewed', 'verification_records', record_id, jsonb_build_object('new_status', new_status, 'note', note));

  -- A verified *vehicle* record exists for exactly one reason: to gate
  -- publishing. Finish the job instead of making the host come back
  -- and click Publish separately. Same eligible-status set
  -- publish_vehicle itself uses; this runs as the admin (already
  -- authorized above), not the vehicle's owner, so it updates the row
  -- directly rather than calling publish_vehicle (which would fail its
  -- own can_manage_vehicle_privileged check for a non-owning admin).
  if new_status = 'verified' and updated_record.verification_type = 'vehicle' and updated_record.vehicle_id is not null then
    update public.vehicles set status = 'published', updated_at = now()
    where id = updated_record.vehicle_id and status in ('draft', 'pending_review', 'paused', 'archived');
    get diagnostics updated_rows = row_count;
    auto_published := updated_rows > 0;
  end if;

  if updated_record.user_id is not null then
    perform public.notify(
      updated_record.user_id,
      'verification_reviewed',
      case when auto_published then 'Vehicle verified and published' else 'Verification update: ' || new_status end,
      note,
      '/host/vehicles'
    );
  end if;

  return updated_record;
end;
$$;
