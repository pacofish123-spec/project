-- Require a verified identity (national ID, driver's license, or
-- passport — any country, via Stripe Identity's automated document +
-- selfie check or the manual admin-reviewed fallback) before a host
-- can list a car, and before a renter can request to book one.
--
-- Gated at the earliest possible point in each flow:
--   - Hosts: vehicle creation itself (the "owners and members insert
--     vehicles" policy). Nothing downstream — photos, verification
--     requests, publish_vehicle, admin_review_verification's
--     auto-publish — is reachable without a vehicle row existing
--     first, so this one gate covers the whole listing flow.
--   - Renters: create_booking(), same spot as the existing
--     ACCOUNT_SUSPENDED check it already carries.

drop policy if exists "owners and members insert vehicles" on public.vehicles;
create policy "owners and members insert vehicles" on public.vehicles
  for insert
  with check (
    (owner_user_id = auth.uid() or public.is_business_member(business_id))
    and status <> 'published'
    and not exists (select 1 from public.profiles where id = auth.uid() and status <> 'active')
    and exists (
      select 1 from public.verification_records
      where user_id = auth.uid() and verification_type = 'identity' and status = 'verified'
    )
  );

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
  conflict_count integer;
  created_booking public.bookings;
  tax_rate constant numeric := 0.18;
  platform_fee_rate constant numeric := 0.10;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if exists (select 1 from public.profiles where id = auth.uid() and status <> 'active') then
    raise exception 'ACCOUNT_SUSPENDED';
  end if;
  if not exists (
    select 1 from public.verification_records
    where user_id = auth.uid() and verification_type = 'identity' and status = 'verified'
  ) then
    raise exception 'IDENTITY_VERIFICATION_REQUIRED';
  end if;
  if p_ends_at <= p_starts_at then raise exception 'INVALID_DATES'; end if;
  if p_pickup_location is null or trim(p_pickup_location) = '' or p_return_location is null or trim(p_return_location) = '' then
    raise exception 'LOCATIONS_REQUIRED';
  end if;

  select * into target_vehicle from public.vehicles where id = p_vehicle_id and status = 'published' for update;
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

  insert into public.bookings (
    renter_user_id, vehicle_id, starts_at, ends_at, pickup_location, return_location,
    rental_subtotal, discount_total, taxes_total, platform_fee, total, currency, status
  ) values (
    auth.uid(), p_vehicle_id, p_starts_at, p_ends_at, trim(p_pickup_location), trim(p_return_location),
    v_gross_subtotal, v_discount, v_taxes, v_platform_fee,
    v_gross_subtotal - v_discount + v_taxes + v_platform_fee, target_vehicle.base_currency, 'requested'
  ) returning * into created_booking;

  perform public.notify(target_vehicle.owner_user_id, 'booking_requested', 'New booking request', target_vehicle.make || ' ' || target_vehicle.model, '/host/dashboard');

  return created_booking;
end;
$$;

grant execute on function public.create_booking(uuid, timestamptz, timestamptz, text, text) to authenticated;
