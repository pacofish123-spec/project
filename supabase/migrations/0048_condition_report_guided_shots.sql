-- yoRento: the first slice of wedge 03's guided evidentiary capture —
-- a fixed 8-shot sequence (front, back, left, right, interior front,
-- interior rear, odometer, tyre tread), each timestamped client-side
-- at capture time. Stored as jsonb keyed by shot id rather than a
-- fixed set of columns, so the shot list can grow without another
-- migration: { shotKey: { path: text, capturedAt: iso8601 } }.
--
-- Deliberately NOT in this slice (see the wedge audit plan): automatic
-- pickup-vs-return photo diffing, and blocking a booking's status
-- transition on the report existing — both need their own pass.
alter table public.condition_reports add column if not exists shots jsonb not null default '{}';

-- `create or replace` only redefines a function with the *exact same*
-- parameter list — adding report_shots here would otherwise create a
-- second, overloaded submit_condition_report alongside the six-arg
-- version from 0031, which is more surface area for an RPC call to
-- resolve ambiguously than this codebase's pattern (every prior
-- redefinition kept the same signature) relies on. Drop the old
-- signature explicitly first.
drop function if exists public.submit_condition_report(uuid, text, integer, integer, text, text[]);

create or replace function public.submit_condition_report(
  target_booking_id uuid,
  report_stage text,
  report_fuel_level integer default null,
  report_mileage integer default null,
  report_notes text default null,
  report_photo_paths text[] default null,
  report_shots jsonb default null
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
  merged_shots jsonb;
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
  merged_shots := coalesce(report_shots, existing_report.shots, '{}'::jsonb);

  insert into public.condition_reports (booking_id, stage, reported_by, fuel_level, mileage, notes, photo_paths, shots)
  values (target_booking_id, report_stage, auth.uid(), report_fuel_level, report_mileage, report_notes, merged_photo_paths, merged_shots)
  on conflict (booking_id, stage) do update
    set fuel_level = excluded.fuel_level, mileage = excluded.mileage, notes = excluded.notes,
        reported_by = excluded.reported_by, photo_paths = merged_photo_paths, shots = merged_shots,
        acknowledged_by = null, acknowledged_at = null, updated_at = now()
  returning * into result_report;

  return result_report;
end;
$$;

revoke execute on function public.submit_condition_report(uuid, text, integer, integer, text, text[], jsonb) from public;
grant execute on function public.submit_condition_report(uuid, text, integer, integer, text, text[], jsonb) to authenticated;
