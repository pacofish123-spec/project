-- yoRento: photo capture for condition reports. Deferred in 0007
-- because it needs a Storage bucket plus storage.objects RLS, which is
-- worth doing carefully rather than blind.
--
-- Path convention for every object in this bucket:
--   {booking_id}/{stage}/{filename}
-- storage.foldername(name) splits that into an array of path segments,
-- so (storage.foldername(name))[1] is the booking_id and [2] is the
-- stage — that's what the policies below check against, using the same
-- participant logic as every other booking-scoped policy in this app.

insert into storage.buckets (id, name, public)
values ('condition-reports', 'condition-reports', false)
on conflict (id) do nothing;

drop policy if exists "booking participants read condition photos" on storage.objects;
create policy "booking participants read condition photos" on storage.objects for select using (
  bucket_id = 'condition-reports'
  and exists (
    select 1 from public.bookings b
    where b.id::text = (storage.foldername(name))[1]
      and (b.renter_user_id = auth.uid() or exists (
        select 1 from public.vehicles v where v.id = b.vehicle_id
          and (v.owner_user_id = auth.uid() or public.is_business_member(v.business_id))
      ))
  )
);

drop policy if exists "booking participants upload condition photos" on storage.objects;
create policy "booking participants upload condition photos" on storage.objects for insert with check (
  bucket_id = 'condition-reports'
  and exists (
    select 1 from public.bookings b
    where b.id::text = (storage.foldername(name))[1]
      and (b.renter_user_id = auth.uid() or exists (
        select 1 from public.vehicles v where v.id = b.vehicle_id
          and (v.owner_user_id = auth.uid() or public.is_business_member(v.business_id))
      ))
  )
);

drop policy if exists "platform admins read condition photos" on storage.objects;
create policy "platform admins read condition photos" on storage.objects for select using (
  bucket_id = 'condition-reports' and public.is_platform_admin()
);

-- No update/delete policy: once a photo is attached to a condition
-- report it's evidence, not a draft — nobody can overwrite or remove it
-- from the bucket. Re-submitting a report before acknowledgement adds
-- to photo_paths rather than replacing files in place.

-- ---------------------------------------------------------------------
-- submit_condition_report gains an optional photo_paths array. When
-- omitted, the existing photos on the report are preserved (not wiped)
-- so a host can edit the mileage note without having to re-attach
-- photos that already uploaded successfully.
-- ---------------------------------------------------------------------
create or replace function public.submit_condition_report(
  target_booking_id uuid,
  report_stage text,
  report_fuel_level integer default null,
  report_mileage integer default null,
  report_notes text default null,
  report_photo_paths text[] default null
)
returns public.condition_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  target_booking public.bookings;
  is_participant boolean;
  existing_report public.condition_reports;
  merged_photo_paths text[];
  result_report public.condition_reports;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if report_stage not in ('pickup', 'return') then raise exception 'INVALID_STAGE'; end if;

  select * into target_booking from public.bookings where id = target_booking_id;
  if target_booking.id is null then raise exception 'BOOKING_NOT_FOUND'; end if;

  is_participant := target_booking.renter_user_id = auth.uid() or public.can_manage_vehicle(target_booking.vehicle_id);
  if not is_participant then raise exception 'BOOKING_ACCESS_DENIED'; end if;

  select * into existing_report from public.condition_reports where booking_id = target_booking_id and stage = report_stage;

  if existing_report.id is not null and existing_report.reported_by <> auth.uid() and existing_report.acknowledged_at is null then
    raise exception 'REPORT_PENDING_ACKNOWLEDGEMENT';
  end if;

  merged_photo_paths := coalesce(report_photo_paths, existing_report.photo_paths, '{}');

  insert into public.condition_reports (booking_id, stage, reported_by, fuel_level, mileage, notes, photo_paths)
  values (target_booking_id, report_stage, auth.uid(), report_fuel_level, report_mileage, report_notes, merged_photo_paths)
  on conflict (booking_id, stage) do update
    set fuel_level = excluded.fuel_level, mileage = excluded.mileage, notes = excluded.notes,
        reported_by = excluded.reported_by, photo_paths = merged_photo_paths,
        acknowledged_by = null, acknowledged_at = null, updated_at = now()
  returning * into result_report;

  return result_report;
end;
$$;

grant execute on function public.submit_condition_report(uuid, text, integer, integer, text, text[]) to authenticated;
