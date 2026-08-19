-- yoRento: pickup/return condition reports, and a real dispute-opening
-- flow for renters and hosts (previously only admins could move a
-- booking to 'disputed'; there was no way for a participant to raise
-- one in the first place).
--
-- Scope note: photo capture is deliberately NOT wired into the UI this
-- pass. The photo_paths column exists so it's ready, but photo upload
-- needs Supabase Storage bucket + storage.objects RLS policies, which
-- are materially riskier to get right without a way to test them here.
-- Fuel level, mileage, and notes are the part that's safe to ship now.

create table if not exists public.condition_reports (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  stage text not null check (stage in ('pickup', 'return')),
  reported_by uuid not null references public.profiles(id) on delete restrict,
  fuel_level integer check (fuel_level between 0 and 100),
  mileage integer check (mileage >= 0),
  notes text,
  photo_paths text[] not null default '{}',
  acknowledged_by uuid references public.profiles(id) on delete set null,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, stage)
);

alter table public.condition_reports enable row level security;

drop policy if exists "booking participants read condition reports" on public.condition_reports;
create policy "booking participants read condition reports" on public.condition_reports for select using (
  exists (
    select 1 from public.bookings b
    where b.id = booking_id
      and (b.renter_user_id = auth.uid() or exists (
        select 1 from public.vehicles v where v.id = b.vehicle_id
          and (v.owner_user_id = auth.uid() or public.is_business_member(v.business_id))
      ))
  )
);

drop policy if exists "platform admins read all condition reports" on public.condition_reports;
create policy "platform admins read all condition reports" on public.condition_reports for select using (public.is_platform_admin());

-- Writes go through RPCs (not a direct insert/update policy) so the
-- "first submission vs. acknowledgement" rule is enforced consistently.
create or replace function public.submit_condition_report(
  target_booking_id uuid,
  report_stage text,
  report_fuel_level integer default null,
  report_mileage integer default null,
  report_notes text default null
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

  insert into public.condition_reports (booking_id, stage, reported_by, fuel_level, mileage, notes)
  values (target_booking_id, report_stage, auth.uid(), report_fuel_level, report_mileage, report_notes)
  on conflict (booking_id, stage) do update
    set fuel_level = excluded.fuel_level, mileage = excluded.mileage, notes = excluded.notes,
        reported_by = excluded.reported_by, acknowledged_by = null, acknowledged_at = null, updated_at = now()
  returning * into result_report;

  return result_report;
end;
$$;

grant execute on function public.submit_condition_report(uuid, text, integer, integer, text) to authenticated;

create or replace function public.acknowledge_condition_report(report_id uuid)
returns public.condition_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  target_report public.condition_reports;
  target_booking public.bookings;
  is_participant boolean;
  updated_report public.condition_reports;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;

  select * into target_report from public.condition_reports where id = report_id;
  if target_report.id is null then raise exception 'REPORT_NOT_FOUND'; end if;
  if target_report.reported_by = auth.uid() then raise exception 'CANNOT_ACKNOWLEDGE_OWN_REPORT'; end if;

  select * into target_booking from public.bookings where id = target_report.booking_id;
  is_participant := target_booking.renter_user_id = auth.uid() or public.can_manage_vehicle(target_booking.vehicle_id);
  if not is_participant then raise exception 'BOOKING_ACCESS_DENIED'; end if;

  update public.condition_reports set acknowledged_by = auth.uid(), acknowledged_at = now(), updated_at = now()
  where id = report_id
  returning * into updated_report;

  return updated_report;
end;
$$;

grant execute on function public.acknowledge_condition_report(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Disputes: previously only admin_set_booking_status could move a
-- booking to 'disputed'. This lets a participant raise one directly.
-- The reason is logged as a message on the booking's thread (which
-- admins can already read) rather than a new column, so the dispute
-- carries its own evidence trail from the moment it's opened.
-- ---------------------------------------------------------------------
create or replace function public.open_dispute(target_booking_id uuid, reason text)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  target_booking public.bookings;
  updated_booking public.bookings;
  is_renter boolean;
  is_host boolean;
  target_vehicle public.vehicles;
  other_party uuid;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if reason is null or trim(reason) = '' then raise exception 'REASON_REQUIRED'; end if;

  select * into target_booking from public.bookings where id = target_booking_id;
  if target_booking.id is null then raise exception 'BOOKING_NOT_FOUND'; end if;

  is_renter := target_booking.renter_user_id = auth.uid();
  select public.can_manage_vehicle(target_booking.vehicle_id) into is_host;
  if not is_renter and not is_host then raise exception 'BOOKING_ACCESS_DENIED'; end if;

  if target_booking.status not in ('accepted', 'in_progress', 'completed') then
    raise exception 'BOOKING_NOT_DISPUTABLE';
  end if;

  insert into public.messages (booking_id, sender_user_id, body)
  values (target_booking_id, auth.uid(), 'Dispute opened: ' || trim(reason));

  update public.bookings set status = 'disputed', updated_at = now()
  where id = target_booking_id
  returning * into updated_booking;

  select * into target_vehicle from public.vehicles where id = updated_booking.vehicle_id;
  other_party := case when is_renter then target_vehicle.owner_user_id else updated_booking.renter_user_id end;
  perform public.notify(other_party, 'dispute_opened', 'A dispute was opened on your booking', trim(reason), '/trips');

  return updated_booking;
end;
$$;

grant execute on function public.open_dispute(uuid, text) to authenticated;
