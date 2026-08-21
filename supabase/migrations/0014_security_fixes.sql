-- yoRento: fixes for the security/correctness issues surfaced by the
-- background code review — cross-host extras injection, forged extras,
-- a double-booking race, a non-atomic inventory race, and decorative
-- business-member roles on the two most consequential vehicle actions.

-- ---------------------------------------------------------------------
-- 1. Forged extras: "owners manage their extras" let anyone attach a
-- business_id they had no relationship to, because owner_user_id =
-- auth.uid() alone satisfied the OR — is_business_member(business_id)
-- was never actually required for business-tagged extras.
-- ---------------------------------------------------------------------
drop policy if exists "owners manage their extras" on public.extras;
create policy "owners manage their extras" on public.extras
  for all
  using (owner_user_id = auth.uid() and (business_id is null or public.is_business_member(business_id)))
  with check (owner_user_id = auth.uid() and (business_id is null or public.is_business_member(business_id)));

-- The CHECK meant to backstop host-linkage integrity was a tautology
-- ((business_id is null) or (business_id is not null) — always true).
-- The RLS policy above is the actual enforcement now; the constraint
-- added nothing and only implied a validation that didn't exist.
alter table public.extras drop constraint if exists extra_host_relationship;

-- ---------------------------------------------------------------------
-- 2. Cross-host extras: a renter could attach ANY host's active extra to
-- a booking with a DIFFERENT host's vehicle — price/active were checked,
-- host-linkage never was. Require the extra's host to match the
-- booking's vehicle's host.
-- ---------------------------------------------------------------------
drop policy if exists "renters add extras to their own requested bookings" on public.booking_extras;
create policy "renters add extras to their own requested bookings" on public.booking_extras
  for insert
  with check (
    exists (select 1 from public.bookings b where b.id = booking_id and b.renter_user_id = auth.uid() and b.status = 'requested')
    and exists (select 1 from public.extras e where e.id = extra_id and e.active and e.price = unit_price)
    and exists (
      select 1
      from public.bookings b
      join public.vehicles v on v.id = b.vehicle_id
      join public.extras e on e.id = extra_id
      where b.id = booking_id
        and (
          (v.business_id is not null and e.business_id = v.business_id)
          or (v.business_id is null and e.business_id is null and e.owner_user_id = v.owner_user_id)
        )
    )
  );

-- ---------------------------------------------------------------------
-- 3. Double-booking race: the overlap check was a plain SELECT COUNT
-- with no lock, so two concurrent requests for the same vehicle/dates
-- could both pass it before either committed. Locking the vehicle row
-- for the duration of the transaction serializes concurrent attempts on
-- the same vehicle — the second call blocks until the first commits (or
-- rolls back), then re-checks against the now-committed state.
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 4. Non-atomic inventory race: two concurrent accepts on a
-- limited-inventory extra could both read the same stale booked_count.
-- Lock the extras row before computing it.
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
    select * into target_extra from public.extras where id = target_extra_id for update;
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
-- 5. Decorative business-member roles: can_manage_vehicle (the general
-- "is this a host of this vehicle" check) treats every business_members
-- row as equally privileged regardless of role, even though the role
-- column exists specifically to distinguish them. Rather than tighten
-- can_manage_vehicle itself — it also gates messaging, condition
-- reports, and responding to bookings, which are reasonable for any
-- team member to do day-to-day — add a stricter check for the two
-- actions where the review's concern is real: publishing a listing live
-- and deleting one outright. A plain 'member' can still message
-- renters, submit condition reports, and respond to booking requests.
-- ---------------------------------------------------------------------
create or replace function public.can_manage_vehicle_privileged(target_vehicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.vehicles v
    where v.id = target_vehicle_id
      and (
        v.owner_user_id = auth.uid()
        or exists (
          select 1 from public.business_members bm
          where bm.business_id = v.business_id and bm.user_id = auth.uid() and bm.role in ('owner', 'manager')
        )
      )
  );
$$;

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
  where id = target_vehicle_id and status in ('draft', 'pending_review', 'paused')
  returning * into updated_vehicle;

  if updated_vehicle.id is null then raise exception 'VEHICLE_NOT_ELIGIBLE'; end if;
  return updated_vehicle;
end;
$$;

grant execute on function public.publish_vehicle(uuid) to authenticated;

drop policy if exists "owners and members delete vehicles" on public.vehicles;
create policy "owners and members delete vehicles" on public.vehicles
  for delete
  using (public.can_manage_vehicle_privileged(id));
