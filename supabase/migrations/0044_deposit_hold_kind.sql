-- yoRento: adds 'deposit_hold' as a payment_records kind, for the
-- optional $300 refundable deposit (vs. the damage-waiver fee, which
-- is just a normal 'charge'). Lifecycle deliberately reuses the
-- existing payment_status enum rather than growing it — 'authorized'
-- has sat unused since 0001, clearly meant for exactly this:
--   pending -> authorized (hold placed)
--            -> refunded (released clean, on a return-stage condition
--               report acknowledgment)
--            -> paid (captured for damage, admin-only action)
--
-- Same dynamic constraint-name lookup 0004_admin_platform.sql used for
-- user_capabilities — the inline check from 0027 has no explicit name.
do $$
declare
  existing_constraint text;
begin
  select con.conname into existing_constraint
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'payment_records'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%kind%charge%';

  if existing_constraint is not null then
    execute format('alter table public.payment_records drop constraint %I', existing_constraint);
  end if;
end $$;

-- 'insurance_waiver' too — the other half of the pay-time choice (a
-- non-refundable fee, as opposed to the refundable deposit_hold above).
-- Kept as its own kind rather than reusing 'charge' so it never
-- collides with create_pending_payment's "already paid the rental"
-- check, which specifically looks for kind = 'charge'.
alter table public.payment_records add constraint payment_records_kind_check
  check (kind in ('charge', 'refund', 'payout', 'deposit_hold', 'insurance_waiver'));

-- create_deposit_hold: same shape/guardrails as create_pending_payment
-- (0027) — amount is derived server-side, never trusted from the
-- client, and only the booking's own renter can call it, only once
-- it's been accepted, and only one hold at a time per booking.
create or replace function public.create_deposit_hold(
  target_booking_id uuid,
  target_provider text,
  hold_amount numeric,
  hold_currency text
)
returns public.payment_records
language plpgsql
security definer
set search_path = public
as $$
declare
  target_booking public.bookings;
  result_record public.payment_records;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if target_provider not in ('stripe', 'paypal') then raise exception 'INVALID_PROVIDER'; end if;

  select * into target_booking from public.bookings where id = target_booking_id;
  if target_booking.id is null then raise exception 'BOOKING_NOT_FOUND'; end if;
  if target_booking.renter_user_id <> auth.uid() then raise exception 'BOOKING_ACCESS_DENIED'; end if;
  if target_booking.status not in ('accepted', 'in_progress') then raise exception 'BOOKING_NOT_PAYABLE'; end if;

  if exists (
    select 1 from public.payment_records
    where booking_id = target_booking_id and kind = 'deposit_hold' and status in ('pending', 'authorized')
  ) then
    raise exception 'DEPOSIT_ALREADY_HELD';
  end if;

  insert into public.payment_records (booking_id, payer_user_id, provider, kind, amount, currency, status)
  values (target_booking_id, auth.uid(), target_provider, 'deposit_hold', hold_amount, hold_currency, 'pending')
  returning * into result_record;

  return result_record;
end;
$$;

revoke execute on function public.create_deposit_hold(uuid, text, numeric, text) from public;
grant execute on function public.create_deposit_hold(uuid, text, numeric, text) to authenticated;

-- create_insurance_waiver_charge: the other half of the pay-time
-- choice — a real (non-refundable) charge, rate × rental_days, at
-- whatever rate/currency an admin has set in platform_settings
-- (migration 0043). Refuses to run at all while the waiver is
-- disabled or has no rate set, so this can never be called into
-- charging renters for a product that doesn't exist yet, even if the
-- client-side gate on rendering the option were somehow bypassed.
create or replace function public.create_insurance_waiver_charge(
  target_booking_id uuid,
  target_provider text
)
returns public.payment_records
language plpgsql
security definer
set search_path = public
as $$
declare
  target_booking public.bookings;
  settings public.platform_settings;
  rental_days integer;
  waiver_amount numeric(12,2);
  result_record public.payment_records;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if target_provider not in ('stripe', 'paypal') then raise exception 'INVALID_PROVIDER'; end if;

  select * into settings from public.platform_settings where id = true;
  if settings.id is null or not settings.insurance_waiver_enabled or settings.insurance_waiver_daily_rate is null then
    raise exception 'WAIVER_NOT_AVAILABLE';
  end if;

  select * into target_booking from public.bookings where id = target_booking_id;
  if target_booking.id is null then raise exception 'BOOKING_NOT_FOUND'; end if;
  if target_booking.renter_user_id <> auth.uid() then raise exception 'BOOKING_ACCESS_DENIED'; end if;
  if target_booking.status not in ('accepted', 'in_progress') then raise exception 'BOOKING_NOT_PAYABLE'; end if;

  if exists (
    select 1 from public.payment_records
    where booking_id = target_booking_id and kind = 'insurance_waiver' and status in ('pending', 'paid')
  ) then
    raise exception 'WAIVER_ALREADY_CHARGED';
  end if;

  rental_days := ceil(extract(epoch from (target_booking.ends_at - target_booking.starts_at)) / 86400.0);
  waiver_amount := round(settings.insurance_waiver_daily_rate * greatest(rental_days, 1), 2);

  insert into public.payment_records (booking_id, payer_user_id, provider, kind, amount, currency, status)
  values (target_booking_id, auth.uid(), target_provider, 'insurance_waiver', waiver_amount, settings.insurance_waiver_currency, 'pending')
  returning * into result_record;

  return result_record;
end;
$$;

revoke execute on function public.create_insurance_waiver_charge(uuid, text) from public;
grant execute on function public.create_insurance_waiver_charge(uuid, text) to authenticated;
