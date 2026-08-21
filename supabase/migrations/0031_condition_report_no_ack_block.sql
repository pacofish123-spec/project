-- yoRento: submit_condition_report blocked anyone but the original
-- reporter from saving a stage's report until it was acknowledged —
-- meant to stop one party silently overwriting the other's report,
-- but in practice it just meant the second person to open the page
-- (commonly the renter, right after the host already logged the
-- pickup condition) couldn't save anything at all and hit a flat
-- "awaiting the other party's acknowledgement" error.
--
-- Flip the protection to the case that actually matters: once a
-- report has been acknowledged (both sides have effectively agreed to
-- it), it shouldn't be silently changed out from under that
-- agreement. Before that point, either participant can save the
-- stage's report freely, same as the very first submission already
-- could.
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

  if existing_report.id is not null and existing_report.acknowledged_at is not null and existing_report.reported_by <> auth.uid() then
    raise exception 'REPORT_ALREADY_ACKNOWLEDGED';
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

revoke execute on function public.submit_condition_report(uuid, text, integer, integer, text, text[]) from public;
grant execute on function public.submit_condition_report(uuid, text, integer, integer, text, text[]) to authenticated;
