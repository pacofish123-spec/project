-- yoRento fixes: close direct-write holes in booking/vehicle RLS, add
-- security-definer transition functions, and open up policies that were
-- accidentally unusable from the client (reviews, extras).

-- ---------------------------------------------------------------------
-- Bookings: a renter could previously UPDATE their own booking row with
-- no restriction on which columns changed, since "participants update
-- bookings" only checked renter_user_id = auth.uid() in both USING and
-- WITH CHECK. That let a renter set status to 'accepted'/'completed' or
-- rewrite totals directly against Supabase, bypassing the accept/decline
-- logic in the API route entirely. Direct client updates to bookings are
-- now disallowed; all status transitions go through security-definer
-- functions that enforce who may call them and which transitions are legal.
-- ---------------------------------------------------------------------
drop policy if exists "participants update bookings" on public.bookings;

create or replace function public.respond_to_booking(target_booking_id uuid, decision text)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  target_booking public.bookings;
  updated_booking public.bookings;
  is_host boolean;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if decision not in ('accepted', 'declined') then raise exception 'INVALID_DECISION'; end if;

  select * into target_booking from public.bookings where id = target_booking_id;
  if target_booking.id is null then raise exception 'BOOKING_NOT_FOUND'; end if;

  select public.can_manage_vehicle(target_booking.vehicle_id) into is_host;
  if not is_host then raise exception 'BOOKING_ACCESS_DENIED'; end if;

  update public.bookings set status = decision::public.booking_status, updated_at = now()
  where id = target_booking_id and status = 'requested'
  returning * into updated_booking;

  if updated_booking.id is null then raise exception 'BOOKING_NOT_PENDING'; end if;
  return updated_booking;
end;
$$;

create or replace function public.cancel_booking(target_booking_id uuid)
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
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;

  select * into target_booking from public.bookings where id = target_booking_id;
  if target_booking.id is null then raise exception 'BOOKING_NOT_FOUND'; end if;

  is_renter := target_booking.renter_user_id = auth.uid();
  select public.can_manage_vehicle(target_booking.vehicle_id) into is_host;
  if not is_renter and not is_host then raise exception 'BOOKING_ACCESS_DENIED'; end if;

  update public.bookings set status = 'cancelled', updated_at = now()
  where id = target_booking_id and status in ('requested', 'accepted')
  returning * into updated_booking;

  if updated_booking.id is null then raise exception 'BOOKING_NOT_CANCELLABLE'; end if;
  return updated_booking;
end;
$$;

grant execute on function public.respond_to_booking(uuid, text) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Vehicles: an owner could previously flip status straight to 'published'
-- by themselves with no verification gate, even though the marketplace UI
-- shows a "verified" trust badge on published listings. Direct client
-- writes can no longer set status = 'published'; that transition only
-- happens through publish_vehicle(), which requires a verified
-- verification_records row for the vehicle. Editing an already-published
-- vehicle (price, pausing it, etc.) still works directly.
-- ---------------------------------------------------------------------
drop policy if exists "owners and members manage vehicles" on public.vehicles;

create policy "owners and members insert vehicles" on public.vehicles
  for insert
  with check ((owner_user_id = auth.uid() or public.is_business_member(business_id)) and status <> 'published');

create policy "owners and members edit non-published vehicles" on public.vehicles
  for update
  using (owner_user_id = auth.uid() or public.is_business_member(business_id))
  with check ((owner_user_id = auth.uid() or public.is_business_member(business_id)) and status <> 'published');

create policy "owners and members edit published vehicles" on public.vehicles
  for update
  using ((owner_user_id = auth.uid() or public.is_business_member(business_id)) and status = 'published')
  with check (owner_user_id = auth.uid() or public.is_business_member(business_id));

create policy "owners and members delete vehicles" on public.vehicles
  for delete
  using (owner_user_id = auth.uid() or public.is_business_member(business_id));

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
  if not public.can_manage_vehicle(target_vehicle_id) then raise exception 'VEHICLE_ACCESS_DENIED'; end if;

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

-- ---------------------------------------------------------------------
-- Extras had no SELECT policy (unreadable) and booking_extras had no way
-- to be written by a renter. Add narrow, price-safe policies so both are
-- actually usable once the extras UI exists.
-- ---------------------------------------------------------------------
create policy "extras are readable when active or managed" on public.extras
  for select
  using (active = true or owner_user_id = auth.uid() or public.is_business_member(business_id));

create policy "owners manage their extras" on public.extras
  for all
  using (owner_user_id = auth.uid() or public.is_business_member(business_id))
  with check (owner_user_id = auth.uid() or public.is_business_member(business_id));

create policy "booking participants read booking extras" on public.booking_extras
  for select
  using (exists (
    select 1 from public.bookings b
    where b.id = booking_id
      and (b.renter_user_id = auth.uid() or exists (
        select 1 from public.vehicles v where v.id = b.vehicle_id
          and (v.owner_user_id = auth.uid() or public.is_business_member(v.business_id))
      ))
  ));

create policy "renters add extras to their own requested bookings" on public.booking_extras
  for insert
  with check (
    exists (select 1 from public.bookings b where b.id = booking_id and b.renter_user_id = auth.uid() and b.status = 'requested')
    and exists (select 1 from public.extras e where e.id = extra_id and e.active and e.price = unit_price)
  );

-- ---------------------------------------------------------------------
-- Reviews had no INSERT policy at all, so nobody could ever leave one.
-- Only a participant of a *completed* booking may review it.
-- ---------------------------------------------------------------------
create policy "participants review completed bookings" on public.reviews
  for insert
  with check (
    author_user_id = auth.uid()
    and exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and b.status = 'completed'
        and (b.renter_user_id = auth.uid() or exists (
          select 1 from public.vehicles v where v.id = b.vehicle_id and v.owner_user_id = auth.uid()
        ))
    )
  );

-- payment_records and verification_records intentionally still have no
-- INSERT/UPDATE policy for authenticated users: those are meant to be
-- written by a trusted backend (payment webhook / verification provider
-- via the service role), not directly by renters or hosts.
