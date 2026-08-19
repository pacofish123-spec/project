-- yoRento: close the top 5 spec-compliance gaps from the audit.
-- 1. Personal hosting was unreachable — can_host_personally was never granted.
-- 2. Duplicate detection couldn't actually detect duplicates — phone/DOB were
--    collected at sign-up but never persisted, so only email matching worked.
-- 3. The registration-check endpoint leaked account existence, and OAuth
--    sign-in bypassed the duplicate-account gate entirely.
-- 4. Booking price wasn't server-authoritative — a renter could INSERT a
--    booking directly against Supabase with any total they liked.
-- 5. publish_vehicle() (added in 0002) was never reachable from the app —
--    nothing could ever go live. This adds the verification-request step
--    that feeds it.

-- ---------------------------------------------------------------------
-- 1 + 2: handle_new_user now grants can_host_personally alongside
-- can_rent (every account can host personally without creating a
-- business, matching "personal hosting is a capability, not a
-- business"), and persists phone/normalized_phone/date_of_birth so the
-- duplicate matcher has real signals to check instead of permanently
---null columns. Also widens the display-name fallback to OAuth's
-- typical metadata keys, which incidentally makes name-based matching
-- usable for OAuth accounts too.
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
begin
  insert into public.profiles (id, display_name, normalized_name, phone, normalized_phone, date_of_birth)
  values (
    new.id,
    resolved_display_name,
    lower(trim(resolved_display_name)),
    nullif(raw_phone, ''),
    norm_phone,
    parsed_dob
  )
  on conflict (id) do nothing;

  insert into public.user_capabilities (user_id, capability)
  values (new.id, 'can_rent'), (new.id, 'can_host_personally')
  on conflict (user_id, capability) do nothing;

  insert into public.renter_profiles (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Backfill: existing accounts should not be worse off than new ones —
-- they were blocked from personal hosting by the same bug.
insert into public.user_capabilities (user_id, capability)
select id, 'can_host_personally' from public.profiles
on conflict (user_id, capability) do nothing;

-- ---------------------------------------------------------------------
-- 3a: check_registration_identity gains an excluding_user_id so it can
-- safely be re-run against "everyone except me" after an account
-- already exists (needed for the OAuth gate below, since an OAuth
-- sign-in creates the auth.users row before we get a chance to check).
-- ---------------------------------------------------------------------
drop function if exists public.check_registration_identity(text, text, text, date);

create or replace function public.check_registration_identity(
  registration_email text,
  registration_phone text default null,
  registration_name text default null,
  registration_date_of_birth date default null,
  excluding_user_id uuid default null
)
returns public.duplicate_match_level
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  email_match boolean;
  phone_match boolean;
  name_match boolean;
begin
  select exists (
    select 1 from auth.users
    where lower(email) = lower(trim(registration_email))
      and email_confirmed_at is not null
      and (excluding_user_id is null or id <> excluding_user_id)
  ) into email_match;
  select exists (
    select 1 from public.profiles
    where normalized_phone is not null and normalized_phone = registration_phone
      and (excluding_user_id is null or id <> excluding_user_id)
  ) into phone_match;
  select exists (
    select 1 from public.profiles
    where normalized_name = lower(trim(registration_name)) and date_of_birth = registration_date_of_birth
      and (excluding_user_id is null or id <> excluding_user_id)
  ) into name_match;
  if email_match and phone_match then return 'CONFIRMED_MATCH'; end if;
  if email_match or phone_match then return 'STRONG_MATCH'; end if;
  if name_match then return 'POSSIBLE_MATCH'; end if;
  return 'NO_MATCH';
end;
$$;

grant execute on function public.check_registration_identity(text, text, text, date, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3b: OAuth accounts never ran through any duplicate check. There's no
-- way to check *before* the auth.users row exists (the provider redirect
-- resolves the email server-side), so instead: right after a brand-new
-- OAuth sign-in, the app collects phone + date of birth (mirroring what
-- email sign-up already collects) and calls this — which checks against
-- every *other* account and, on a strong match, flags it into
-- account_merge_candidates for review rather than silently doing
-- nothing. It never auto-merges or auto-blocks (spec 5U), and it never
-- reveals which account matched back to the client.
-- ---------------------------------------------------------------------
create or replace function public.check_and_flag_oauth_identity(
  registration_phone text default null,
  registration_name text default null,
  registration_date_of_birth date default null
)
returns public.duplicate_match_level
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  self_email text;
  matched_id uuid;
  norm_name text := lower(trim(registration_name));
  result_level public.duplicate_match_level;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  select email into self_email from auth.users where id = auth.uid();

  select p.id into matched_id
  from public.profiles p
  where p.id <> auth.uid()
    and (
      (registration_phone is not null and p.normalized_phone = registration_phone)
      or (registration_date_of_birth is not null and p.normalized_name = norm_name and p.date_of_birth = registration_date_of_birth)
      or exists (
        select 1 from auth.users u
        where u.id = p.id and u.id <> auth.uid()
          and lower(u.email) = lower(trim(self_email)) and u.email_confirmed_at is not null
      )
    )
  limit 1;

  if matched_id is null then
    return 'NO_MATCH';
  end if;

  if (registration_phone is not null and exists (select 1 from public.profiles p where p.id = matched_id and p.normalized_phone = registration_phone))
    or exists (select 1 from auth.users u where u.id = matched_id and lower(u.email) = lower(trim(self_email)) and u.email_confirmed_at is not null)
  then
    result_level := 'STRONG_MATCH';
  else
    result_level := 'POSSIBLE_MATCH';
  end if;

  insert into public.account_merge_candidates (canonical_user_id, candidate_user_id, match_level, reasons)
  select matched_id, auth.uid(), result_level, '["oauth_identity_check"]'::jsonb
  where not exists (
    select 1 from public.account_merge_candidates
    where canonical_user_id = matched_id and candidate_user_id = auth.uid() and status in ('flagged', 'under_review')
  );

  return result_level;
end;
$$;

grant execute on function public.check_and_flag_oauth_identity(text, text, date) to authenticated;

-- ---------------------------------------------------------------------
-- 4: bookings could be INSERTed directly by any authenticated client
-- with a self-supplied total. Move creation into a security-definer
-- function that recomputes price from the vehicle's real daily_price,
-- validates availability, and is the only way to create a booking row.
-- ---------------------------------------------------------------------
drop policy if exists "renters create bookings for themselves" on public.bookings;

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
  computed_subtotal numeric(12,2);
  conflict_count integer;
  created_booking public.bookings;
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

  computed_subtotal := target_vehicle.daily_price * rental_days;

  insert into public.bookings (
    renter_user_id, vehicle_id, starts_at, ends_at, pickup_location, return_location,
    rental_subtotal, total, currency, status
  ) values (
    auth.uid(), p_vehicle_id, p_starts_at, p_ends_at, trim(p_pickup_location), trim(p_return_location),
    computed_subtotal, computed_subtotal, target_vehicle.base_currency, 'requested'
  ) returning * into created_booking;

  return created_booking;
end;
$$;

grant execute on function public.create_booking(uuid, timestamptz, timestamptz, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5: publish_vehicle() (from 0002) requires a verified 'vehicle'
-- verification_records row, but nothing could ever create one — there
-- was no insert policy and no RPC. This adds the request step: a host
-- can request review for their own vehicle, landing it at 'pending'.
-- Nothing in this app can move it to 'verified' (that's an operator/
-- admin action, intentionally not modeled here — see 0002's note on
-- payment_records/verification_records staying service-role-only), but
-- publish_vehicle is now reachable end-to-end once a record is verified.
-- ---------------------------------------------------------------------
create or replace function public.request_vehicle_verification(target_vehicle_id uuid)
returns public.verification_records
language plpgsql
security definer
set search_path = public
as $$
declare
  created_record public.verification_records;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not public.can_manage_vehicle(target_vehicle_id) then raise exception 'VEHICLE_ACCESS_DENIED'; end if;

  if exists (
    select 1 from public.verification_records
    where vehicle_id = target_vehicle_id and verification_type = 'vehicle' and status in ('pending', 'in_review', 'verified')
  ) then
    raise exception 'VERIFICATION_ALREADY_REQUESTED';
  end if;

  insert into public.verification_records (user_id, vehicle_id, verification_type, status)
  values (auth.uid(), target_vehicle_id, 'vehicle', 'pending')
  returning * into created_record;

  return created_record;
end;
$$;

grant execute on function public.request_vehicle_verification(uuid) to authenticated;
