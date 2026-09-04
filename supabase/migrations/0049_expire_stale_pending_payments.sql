-- yoRento: reclaim payment_records rows stranded in 'pending' by an
-- interrupted checkout (renter closes the tab, loses connection, or
-- just never comes back) so a retry isn't blocked forever.
--
-- Stripe self-heals already: an unstarted Checkout Session auto-expires
-- (~24h) and fires checkout.session.expired, which the webhook
-- (src/app/api/webhooks/stripe/route.ts) uses to flip the row to
-- 'failed'. PayPal sends no equivalent event for an order nobody ever
-- approved — it just goes quiet — so nothing today ever clears that
-- row. create_pending_payment (0027) doesn't block retries on a stray
-- 'pending' row, so the rental charge flow is unaffected either way,
-- but create_deposit_hold and create_insurance_waiver_charge (0044)
-- both explicitly refuse a new attempt while one exists — so a PayPal
-- deposit-hold or waiver charge abandoned before approval permanently
-- locks that booking out of retrying it.
--
-- Fix: both guarded RPCs now reap their own stale 'pending' rows
-- (older than the cutoff below) before checking whether one is already
-- in progress, so the next attempt on that booking clears the jam
-- itself — no cron job or external scheduler required.
--
-- Cutoff is 4 hours, not the ~1 hour that would merely beat PayPal's
-- own ~3-hour order-approval window. It needs to comfortably outlast
-- that window: if we reclaimed the slot while the original PayPal
-- order could still be approved, a late approval on the abandoned
-- order and a freshly inserted retry could both go on to
-- capture/authorize — a real double-charge to the renter, not just a
-- bookkeeping nuisance. Stripe rows are covered by the webhook well
-- before this ever runs; this cutoff exists for PayPal.
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

  update public.payment_records
    set status = 'failed', updated_at = now()
    where booking_id = target_booking_id and kind = 'deposit_hold' and status = 'pending'
      and created_at < now() - interval '4 hours';

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

  update public.payment_records
    set status = 'failed', updated_at = now()
    where booking_id = target_booking_id and kind = 'insurance_waiver' and status = 'pending'
      and created_at < now() - interval '4 hours';

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
