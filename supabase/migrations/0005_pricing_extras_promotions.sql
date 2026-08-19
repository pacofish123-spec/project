-- yoRento: real price calculator, extras approval flow with inventory
-- enforcement, admin-controlled promotions, and a currency-conversion
-- display table.

-- ---------------------------------------------------------------------
-- Bookings need a discount line so weekly/monthly discounts are shown
-- transparently rather than silently folded into a lower subtotal
-- (spec §70 "no surprise fees" cuts both ways — a discount hidden
-- inside the subtotal is just as opaque as a hidden fee).
-- ---------------------------------------------------------------------
alter table public.bookings add column if not exists discount_total numeric(12,2) not null default 0 check (discount_total >= 0);

-- Rebuild create_booking (from 0003) with real pricing: 7+ day rentals
-- get 10% off, 28+ days get 15% off, then a flat tax rate and platform
-- service fee apply to the discounted subtotal. Both rates are named
-- constants below so they're easy to find and adjust — there's no
-- config table for them yet, deliberately: getting the calculation
-- shape right matters more here than making the rate itself editable
-- without a migration.
create or replace function public.create_booking(
  p_vehicle_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_pickup_location text,
  p_return_location text
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  target_vehicle public.vehicles;
  rental_days integer;
  v_gross_subtotal numeric(12,2);
  v_discount numeric(12,2);
  v_taxable numeric(12,2);
  v_taxes numeric(12,2);
  v_platform_fee numeric(12,2);
  v_total numeric(12,2);
  conflict_count integer;
  created_booking public.bookings;
  tax_rate constant numeric := 0.18;      -- placeholder DR-style rate; not country-aware yet
  platform_fee_rate constant numeric := 0.10;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if p_ends_at <= p_starts_at then raise exception 'INVALID_DATES'; end if;
  if p_pickup_location is null or trim(p_pickup_location) = '' or p_return_location is null or trim(p_return_location) = '' then
    raise exception 'LOCATIONS_REQUIRED';
  end if;

  select * into target_vehicle from public.vehicles where id = p_vehicle_id and status = 'published';
  if target_vehicle.id is null then raise exception 'VEHICLE_NOT_AVAILABLE'; end if;

  rental_days := ceil(extract(epoch from (p_ends_at - p_starts_at)) / 86400.0);
  if rental_days < 1 then raise exception 'INVALID_DATES'; end if;

  select count(*) into conflict_count
  from public.bookings b
  where b.vehicle_id = p_vehicle_id
    and b.status in ('requested', 'accepted', 'in_progress')
    and b.starts_at < p_ends_at
    and b.ends_at > p_starts_at;
  if conflict_count > 0 then raise exception 'DATES_UNAVAILABLE'; end if;

  v_gross_subtotal := round(target_vehicle.daily_price * rental_days, 2);
  v_discount := case
    when rental_days >= 28 then round(v_gross_subtotal * 0.15, 2)
    when rental_days >= 7 then round(v_gross_subtotal * 0.10, 2)
    else 0
  end;
  v_taxable := v_gross_subtotal - v_discount;
  v_taxes := round(v_taxable * tax_rate, 2);
  v_platform_fee := round(v_taxable * platform_fee_rate, 2);
  v_total := v_gross_subtotal - v_discount + v_taxes + v_platform_fee;

  insert into public.bookings (
    renter_user_id, vehicle_id, starts_at, ends_at, pickup_location, return_location,
    rental_subtotal, discount_total, taxes_total, platform_fee, total, currency, status
  ) values (
    auth.uid(), p_vehicle_id, p_starts_at, p_ends_at, trim(p_pickup_location), trim(p_return_location),
    v_gross_subtotal, v_discount, v_taxes, v_platform_fee, v_total, target_vehicle.base_currency, 'requested'
  ) returning * into created_booking;

  return created_booking;
end;
$$;

grant execute on function public.create_booking(uuid, timestamptz, timestamptz, text, text) to authenticated;

-- Read-only preview of the same math, so the booking form can show a
-- true breakdown (discount / taxes / platform fee / total) before the
-- renter submits, instead of a client-side guess that could drift from
-- what create_booking actually charges.
create or replace function public.quote_booking(p_vehicle_id uuid, p_starts_at timestamptz, p_ends_at timestamptz)
returns table (
  rental_days integer,
  gross_subtotal numeric,
  discount_total numeric,
  taxes_total numeric,
  platform_fee numeric,
  total numeric,
  currency text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  target_vehicle public.vehicles;
  v_days integer;
  v_gross_subtotal numeric(12,2);
  v_discount numeric(12,2);
  v_taxable numeric(12,2);
  tax_rate constant numeric := 0.18;
  platform_fee_rate constant numeric := 0.10;
begin
  if p_ends_at <= p_starts_at then raise exception 'INVALID_DATES'; end if;

  select * into target_vehicle from public.vehicles where id = p_vehicle_id and status = 'published';
  if target_vehicle.id is null then raise exception 'VEHICLE_NOT_AVAILABLE'; end if;

  v_days := ceil(extract(epoch from (p_ends_at - p_starts_at)) / 86400.0);
  if v_days < 1 then raise exception 'INVALID_DATES'; end if;

  v_gross_subtotal := round(target_vehicle.daily_price * v_days, 2);
  v_discount := case
    when v_days >= 28 then round(v_gross_subtotal * 0.15, 2)
    when v_days >= 7 then round(v_gross_subtotal * 0.10, 2)
    else 0
  end;
  v_taxable := v_gross_subtotal - v_discount;

  return query select
    v_days,
    v_gross_subtotal,
    v_discount,
    round(v_taxable * tax_rate, 2),
    round(v_taxable * platform_fee_rate, 2),
    v_gross_subtotal - v_discount + round(v_taxable * tax_rate, 2) + round(v_taxable * platform_fee_rate, 2),
    target_vehicle.base_currency;
end;
$$;

grant execute on function public.quote_booking(uuid, timestamptz, timestamptz) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Extras: 0002 already let a renter INSERT a booking_extra at the
-- extra's real price for their own requested booking. Nothing could
-- ever move it out of 'requested', and nothing enforced inventory. This
-- adds the host's accept/decline action, which also rolls the accepted
-- amount into bookings.extras_total/total and checks remaining
-- inventory before allowing an accept.
-- ---------------------------------------------------------------------
create or replace function public.respond_to_booking_extra(
  target_booking_id uuid,
  target_extra_id uuid,
  decision text
)
returns public.booking_extras
language plpgsql
security definer
set search_path = public
as $$
declare
  target_booking public.bookings;
  target_extra public.extras;
  current_row public.booking_extras;
  updated_row public.booking_extras;
  booked_count integer;
  line_total numeric(12,2);
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if decision not in ('accepted', 'declined') then raise exception 'INVALID_DECISION'; end if;

  select * into target_booking from public.bookings where id = target_booking_id;
  if target_booking.id is null then raise exception 'BOOKING_NOT_FOUND'; end if;
  if not public.can_manage_vehicle(target_booking.vehicle_id) then raise exception 'BOOKING_ACCESS_DENIED'; end if;

  select * into current_row from public.booking_extras where booking_id = target_booking_id and extra_id = target_extra_id;
  if current_row.booking_id is null then raise exception 'EXTRA_REQUEST_NOT_FOUND'; end if;
  if current_row.status <> 'requested' then raise exception 'EXTRA_ALREADY_RESOLVED'; end if;

  if decision = 'accepted' then
    select * into target_extra from public.extras where id = target_extra_id;
    if target_extra.inventory_count is not null then
      select coalesce(sum(quantity), 0) into booked_count
      from public.booking_extras
      where extra_id = target_extra_id and status = 'accepted';
      if booked_count + current_row.quantity > target_extra.inventory_count then
        raise exception 'EXTRA_OUT_OF_STOCK';
      end if;
    end if;

    line_total := current_row.unit_price * current_row.quantity;
    update public.bookings
    set extras_total = extras_total + line_total, total = total + line_total, updated_at = now()
    where id = target_booking_id;
  end if;

  update public.booking_extras
  set status = decision
  where booking_id = target_booking_id and extra_id = target_extra_id
  returning * into updated_row;

  return updated_row;
end;
$$;

grant execute on function public.respond_to_booking_extra(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Promotions: self-serve "pay to promote" needs real payments, which
-- this app doesn't have yet, so promotion stays an admin-granted flag
-- rather than something a host can buy directly. That keeps the badge
-- honest — nothing here fakes a transaction.
-- ---------------------------------------------------------------------
create or replace function public.admin_set_vehicle_promotion(target_vehicle_id uuid, is_promoted boolean)
returns public.vehicles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_vehicle public.vehicles;
begin
  if not public.is_platform_admin() then raise exception 'ADMIN_ACCESS_REQUIRED'; end if;

  update public.vehicles set promoted = is_promoted, updated_at = now()
  where id = target_vehicle_id
  returning * into updated_vehicle;

  if updated_vehicle.id is null then raise exception 'VEHICLE_NOT_FOUND'; end if;
  return updated_vehicle;
end;
$$;

grant execute on function public.admin_set_vehicle_promotion(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- Currency conversion display (spec §40): store rates relative to USD,
-- publicly readable (exchange rates aren't sensitive), admin-writable.
-- These are approximate/manually-updated, not a live feed — there's no
-- FX API key configured. Seed values are placeholders; update them for
-- real display accuracy.
-- ---------------------------------------------------------------------
create table if not exists public.currency_rates (
  currency text primary key check (currency in ('DOP', 'USD', 'EUR', 'CAD', 'GBP', 'MXN')),
  usd_rate numeric(12,6) not null check (usd_rate > 0),
  updated_at timestamptz not null default now()
);

alter table public.currency_rates enable row level security;

drop policy if exists "currency rates are publicly readable" on public.currency_rates;
create policy "currency rates are publicly readable" on public.currency_rates for select using (true);

insert into public.currency_rates (currency, usd_rate) values
  ('USD', 1),
  ('DOP', 60),
  ('EUR', 0.92),
  ('CAD', 1.36),
  ('GBP', 0.79),
  ('MXN', 17)
on conflict (currency) do nothing;

create or replace function public.admin_set_currency_rate(target_currency text, new_usd_rate numeric)
returns public.currency_rates
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_rate public.currency_rates;
begin
  if not public.is_platform_admin() then raise exception 'ADMIN_ACCESS_REQUIRED'; end if;
  if new_usd_rate <= 0 then raise exception 'INVALID_RATE'; end if;

  insert into public.currency_rates (currency, usd_rate, updated_at)
  values (target_currency, new_usd_rate, now())
  on conflict (currency) do update set usd_rate = excluded.usd_rate, updated_at = excluded.updated_at
  returning * into updated_rate;

  return updated_rate;
end;
$$;

grant execute on function public.admin_set_currency_rate(text, numeric) to authenticated;
