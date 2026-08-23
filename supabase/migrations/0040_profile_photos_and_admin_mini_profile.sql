-- yoRento: pre-launch — profile photos (imported from OAuth, uploaded,
-- or a selfie) become a real gate on hosting/booking, at the exact same
-- spot as the existing verified-identity gate right next to it (0037).
-- Signing up and browsing stay photo-free; only the moment someone
-- tries to book or list a car is blocked, with a clear "pending
-- profile task" pointing at what's missing.
--
-- The admin user directory also gains enough of a mini-profile (phone,
-- DOB, avatar) to do extra verification without leaving the page — the
-- Stripe-extracted ID fields for an automated check are fetched live
-- from the Stripe API by a new route, not stored here.

-- ---------------------------------------------------------------------
-- Avatars: a public bucket, same shape as vehicle-photos (0019) —
-- profile photos are shown all over the app (host cards, popovers, the
-- account page), so a plain public URL is the right fit. Path
-- convention: {user_id}/{filename}.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "anyone can view avatars" on storage.objects;
create policy "anyone can view avatars" on storage.objects for select using (
  bucket_id = 'avatars'
);

drop policy if exists "users upload their own avatar" on storage.objects;
create policy "users upload their own avatar" on storage.objects for insert with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users update their own avatar" on storage.objects;
create policy "users update their own avatar" on storage.objects for update using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users delete their own avatar" on storage.objects;
create policy "users delete their own avatar" on storage.objects for delete using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);

-- ---------------------------------------------------------------------
-- OAuth sign-ups already hand over a photo — pull it in automatically
-- instead of leaving avatar_url null and making them do it again.
-- Supabase normalizes Google/Facebook profile photos to
-- user_metadata.avatar_url; 'picture' is kept as a fallback for
-- providers that don't.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_phone text := new.raw_user_meta_data ->> 'phone';
  digits text := regexp_replace(coalesce(raw_phone, ''), '\D', '', 'g');
  norm_phone text := case when length(digits) = 10 then '1' || digits when length(digits) > 0 then digits else null end;
  raw_dob text := new.raw_user_meta_data ->> 'date_of_birth';
  parsed_dob date := case when raw_dob ~ '^\d{4}-\d{2}-\d{2}$' then raw_dob::date else null end;
  resolved_display_name text := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    split_part(coalesce(new.email, 'yoRento user'), '@', 1)
  );
  resolved_avatar_url text := coalesce(
    nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
    nullif(new.raw_user_meta_data ->> 'picture', '')
  );
begin
  insert into public.profiles (id, display_name, normalized_name, phone, normalized_phone, date_of_birth, avatar_url)
  values (
    new.id,
    resolved_display_name,
    lower(trim(resolved_display_name)),
    nullif(raw_phone, ''),
    norm_phone,
    parsed_dob,
    resolved_avatar_url
  )
  on conflict (id) do nothing;

  insert into public.user_capabilities (user_id, capability)
  values (new.id, 'can_rent'), (new.id, 'can_host_personally')
  on conflict (user_id, capability) do nothing;

  insert into public.renter_profiles (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- The photo gate itself: the earliest point of each flow, same spot as
-- the existing verified-identity check (0037) — hosting is gated at
-- vehicle creation (nothing downstream is reachable without a vehicle
-- row existing first), booking at create_booking(). New error code,
-- PROFILE_PHOTO_REQUIRED, mirrors IDENTITY_VERIFICATION_REQUIRED.
-- ---------------------------------------------------------------------
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
    and exists (select 1 from public.profiles where id = auth.uid() and avatar_url is not null)
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
  if not exists (select 1 from public.profiles where id = auth.uid() and avatar_url is not null) then
    raise exception 'PROFILE_PHOTO_REQUIRED';
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

-- ---------------------------------------------------------------------
-- Admin mini-profile: admin_list_users() gains avatar_url, phone, and
-- date_of_birth so /admin/users can show a compact profile per user
-- without a second round trip. Security definer already lets it read
-- past the column-restricted grant 0017 put on profiles for
-- anon/authenticated — same as every other admin RPC. create or
-- replace can't change the return-table column set, so the old
-- signature has to go first (same note as 0013).
-- ---------------------------------------------------------------------
drop function if exists public.admin_list_users();

create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  display_name text,
  avatar_url text,
  phone text,
  date_of_birth date,
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
    p.avatar_url,
    p.phone,
    p.date_of_birth,
    p.country_code,
    p.account_type,
    p.member_since,
    p.status,
    coalesce(array_agg(uc.capability order by uc.capability) filter (where uc.capability is not null), '{}')
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.user_capabilities uc on uc.user_id = p.id
  group by p.id, u.email, p.display_name, p.avatar_url, p.phone, p.date_of_birth, p.country_code, p.account_type, p.member_since, p.status
  order by p.member_since desc;
end;
$$;

grant execute on function public.admin_list_users() to authenticated;
