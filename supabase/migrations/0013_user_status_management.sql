-- yoRento: admin user management — suspend / reactivate / anonymize
-- ("remove"), enforced at the real choke points a suspended account would
-- otherwise still be able to use (booking, publishing, new listings).
-- No service-role key in this app, so this is soft/application-level:
-- it does not prevent sign-in itself, only marketplace actions.

alter table public.profiles add column if not exists status text not null default 'active' check (status in ('active', 'suspended', 'deleted'));
alter table public.profiles add column if not exists suspended_reason text;
alter table public.profiles add column if not exists suspended_at timestamptz;

create or replace function public.admin_set_user_status(
  target_user_id uuid,
  new_status text,
  reason text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.profiles;
begin
  if not public.is_platform_admin() then raise exception 'ADMIN_ACCESS_REQUIRED'; end if;
  if target_user_id = auth.uid() then raise exception 'CANNOT_MODIFY_OWN_STATUS'; end if;
  if new_status not in ('active', 'suspended', 'deleted') then raise exception 'INVALID_STATUS'; end if;

  update public.profiles
  set
    status = new_status,
    suspended_reason = case when new_status = 'active' then null else reason end,
    suspended_at = case when new_status = 'active' then null else coalesce(suspended_at, now()) end,
    -- "Remove" is an anonymize, not a row delete — on delete restrict on
    -- every FK to profiles means a real delete would fail for anyone with
    -- booking/vehicle history anyway, so scrub identity instead.
    display_name = case when new_status = 'deleted' then 'Deleted user' else display_name end,
    normalized_name = case when new_status = 'deleted' then null else normalized_name end,
    phone = case when new_status = 'deleted' then null else phone end,
    normalized_phone = case when new_status = 'deleted' then null else normalized_phone end,
    avatar_url = case when new_status = 'deleted' then null else avatar_url end,
    updated_at = now()
  where id = target_user_id
  returning * into updated_profile;

  if updated_profile.id is null then raise exception 'USER_NOT_FOUND'; end if;

  -- Suspending/removing someone pulls their personally-owned listings out
  -- of the marketplace immediately. Business-hosted vehicles are left
  -- alone — one suspended member shouldn't silently pause a whole fleet
  -- other members are actively running.
  if new_status in ('suspended', 'deleted') then
    update public.vehicles set status = 'paused', updated_at = now()
    where owner_user_id = target_user_id and status = 'published';
  end if;

  insert into public.audit_logs (actor_user_id, event_type, target_type, target_id, metadata)
  values (auth.uid(), 'user_status_changed', 'profiles', target_user_id, jsonb_build_object('new_status', new_status, 'reason', reason));

  return updated_profile;
end;
$$;

grant execute on function public.admin_set_user_status(uuid, text, text) to authenticated;

-- admin_list_users now also surfaces status so the directory can show it.
-- create or replace can't change a function's return-table column set,
-- so the old signature has to go first.
drop function if exists public.admin_list_users();

create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  display_name text,
  country_code text,
  account_type public.account_type,
  member_since timestamptz,
  status text,
  capabilities text[]
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_platform_admin() then raise exception 'ADMIN_ACCESS_REQUIRED'; end if;

  return query
  select
    p.id,
    u.email::text,
    p.display_name,
    p.country_code,
    p.account_type,
    p.member_since,
    p.status,
    coalesce(array_agg(uc.capability order by uc.capability) filter (where uc.capability is not null), '{}')
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.user_capabilities uc on uc.user_id = p.id
  group by p.id, u.email, p.display_name, p.country_code, p.account_type, p.member_since, p.status
  order by p.member_since desc;
end;
$$;

grant execute on function public.admin_list_users() to authenticated;

-- Enforcement: a suspended/deleted account can't create a new booking...
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

-- ...or publish a vehicle...
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

-- ...or create a new listing at all.
drop policy if exists "owners and members insert vehicles" on public.vehicles;
create policy "owners and members insert vehicles" on public.vehicles
  for insert
  with check (
    (owner_user_id = auth.uid() or public.is_business_member(business_id))
    and status <> 'published'
    and not exists (select 1 from public.profiles where id = auth.uid() and status <> 'active')
  );
