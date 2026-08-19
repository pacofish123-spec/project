-- yoRento foundation migration
-- One authenticated person can rent, host personally, and manage businesses.

create extension if not exists "pgcrypto";

create type public.account_type as enum ('personal', 'business', 'mixed');
create type public.host_type as enum ('individual', 'business');
create type public.membership_role as enum ('owner', 'manager', 'member');
create type public.verification_status as enum ('not_started', 'pending', 'in_review', 'verified', 'failed', 'requires_information', 'expired');
create type public.booking_status as enum ('requested', 'accepted', 'declined', 'cancelled', 'in_progress', 'completed', 'disputed');
create type public.payment_status as enum ('pending', 'authorized', 'paid', 'partially_refunded', 'refunded', 'failed');
create type public.duplicate_match_level as enum ('NO_MATCH', 'POSSIBLE_MATCH', 'STRONG_MATCH', 'CONFIRMED_MATCH');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text,
  avatar_url text,
  account_type public.account_type not null default 'personal',
  country_code text not null default 'DO',
  preferred_language text not null default 'es',
  preferred_currency text not null default 'DOP',
  date_of_birth date,
  normalized_name text,
  phone text,
  normalized_phone text,
  member_since timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_capabilities (
  user_id uuid not null references public.profiles(id) on delete restrict,
  capability text not null check (capability in ('can_rent', 'can_host_personally', 'can_host_for_business', 'can_manage_business', 'can_manage_fleet', 'can_receive_payouts')),
  granted_at timestamptz not null default now(),
  granted_by uuid references public.profiles(id) on delete set null,
  primary key (user_id, capability)
);

create table public.renter_profiles (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  completed_rentals integer not null default 0 check (completed_rentals >= 0),
  rating numeric(3,2) check (rating between 0 and 5),
  response_rate numeric(5,2) check (response_rate between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.host_profiles (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  completed_rentals integer not null default 0 check (completed_rentals >= 0),
  rating numeric(3,2) check (rating between 0 and 5),
  response_rate numeric(5,2) check (response_rate between 0 and 100),
  response_time_minutes integer check (response_time_minutes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  description text,
  country_code text not null default 'DO',
  city text,
  verification_status public.verification_status not null default 'not_started',
  rating numeric(3,2) check (rating between 0 and 5),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_members (
  business_id uuid not null references public.businesses(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  role public.membership_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete restrict,
  business_id uuid references public.businesses(id) on delete restrict,
  host_type public.host_type not null,
  make text not null,
  model text not null,
  year integer not null check (year between 1886 and 2200),
  description text,
  location_city text not null,
  country_code text not null default 'DO',
  latitude numeric(9,6),
  longitude numeric(9,6),
  daily_price numeric(12,2) not null check (daily_price >= 0),
  base_currency text not null default 'DOP',
  transmission text,
  seats integer check (seats between 1 and 99),
  has_ac boolean not null default false,
  fuel_policy text,
  cleaning_policy text,
  easy_return_terms jsonb,
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'published', 'paused', 'archived')),
  promoted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_host_relationship check (
    (host_type = 'individual' and business_id is null)
    or (host_type = 'business' and business_id is not null)
  )
);

create table public.vehicle_photos (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.vehicle_availability (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  starts_on date not null,
  ends_on date not null,
  is_available boolean not null default true,
  constraint availability_dates_valid check (ends_on >= starts_on)
);

create table public.extras (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete restrict,
  business_id uuid references public.businesses(id) on delete restrict,
  name text not null,
  description text,
  price numeric(12,2) not null check (price >= 0),
  currency text not null default 'DOP',
  inventory_count integer check (inventory_count is null or inventory_count >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint extra_host_relationship check ((business_id is null) or (business_id is not null))
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  renter_user_id uuid not null references public.profiles(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  pickup_location text not null,
  return_location text not null,
  status public.booking_status not null default 'requested',
  currency text not null default 'DOP',
  rental_subtotal numeric(12,2) not null check (rental_subtotal >= 0),
  extras_total numeric(12,2) not null default 0 check (extras_total >= 0),
  protection_total numeric(12,2) not null default 0 check (protection_total >= 0),
  taxes_total numeric(12,2) not null default 0 check (taxes_total >= 0),
  platform_fee numeric(12,2) not null default 0 check (platform_fee >= 0),
  total numeric(12,2) not null check (total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_dates_valid check (ends_at > starts_at)
);

create table public.booking_extras (
  booking_id uuid not null references public.bookings(id) on delete restrict,
  extra_id uuid not null references public.extras(id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  status text not null default 'requested' check (status in ('requested', 'accepted', 'declined', 'cancelled')),
  primary key (booking_id, extra_id)
);

create table public.payment_records (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  payer_user_id uuid not null references public.profiles(id) on delete restrict,
  payee_user_id uuid references public.profiles(id) on delete restrict,
  processor_reference text,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null,
  status public.payment_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  author_user_id uuid not null references public.profiles(id) on delete restrict,
  subject_user_id uuid references public.profiles(id) on delete restrict,
  vehicle_id uuid references public.vehicles(id) on delete restrict,
  rating integer not null check (rating between 1 and 5),
  body text,
  created_at timestamptz not null default now(),
  unique (booking_id, author_user_id)
);

create table public.verification_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete restrict,
  business_id uuid references public.businesses(id) on delete restrict,
  vehicle_id uuid references public.vehicles(id) on delete restrict,
  verification_type text not null check (verification_type in ('email', 'phone', 'identity', 'selfie', 'driver', 'payment', 'vehicle', 'business')),
  status public.verification_status not null default 'not_started',
  provider text,
  provider_reference text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint verification_subject_required check (user_id is not null or business_id is not null or vehicle_id is not null)
);

create table public.account_merge_candidates (
  id uuid primary key default gen_random_uuid(),
  canonical_user_id uuid references public.profiles(id) on delete restrict,
  candidate_user_id uuid references public.profiles(id) on delete restrict,
  match_level public.duplicate_match_level not null,
  reasons jsonb not null default '[]'::jsonb,
  status text not null default 'flagged' check (status in ('flagged', 'under_review', 'verified', 'rejected', 'merged')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index vehicles_search_idx on public.vehicles (country_code, location_city, status, host_type);
create index vehicles_business_idx on public.vehicles (business_id) where business_id is not null;
create index bookings_vehicle_dates_idx on public.bookings (vehicle_id, starts_at, ends_at);
create index bookings_renter_idx on public.bookings (renter_user_id, created_at desc);
create index business_members_user_idx on public.business_members (user_id, business_id);
create index verification_subject_idx on public.verification_records (user_id, business_id, vehicle_id);
create index profiles_normalized_phone_idx on public.profiles (normalized_phone) where normalized_phone is not null;

create or replace view public.public_profiles as
select id, display_name, avatar_url, country_code, member_since
from public.profiles;
grant select on public.public_profiles to anon, authenticated;

create or replace function public.is_business_member(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.business_members
    where business_id = target_business_id and user_id = auth.uid()
  );
$$;

create or replace function public.can_manage_vehicle(target_vehicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.vehicles v
    where v.id = target_vehicle_id
      and (v.owner_user_id = auth.uid() or public.is_business_member(v.business_id))
  );
$$;

create or replace function public.create_business(
  business_name text,
  business_slug text,
  business_description text default null,
  business_country_code text default 'DO',
  business_city text default null
)
returns public.businesses
language plpgsql
security definer
set search_path = public
as $$
declare
  created_business public.businesses;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  insert into public.businesses (name, slug, description, country_code, city, created_by)
  values (business_name, business_slug, business_description, business_country_code, business_city, auth.uid())
  returning * into created_business;

  insert into public.business_members (business_id, user_id, role)
  values (created_business.id, auth.uid(), 'owner');

  insert into public.user_capabilities (user_id, capability, granted_by)
  values (auth.uid(), 'can_manage_business', auth.uid()), (auth.uid(), 'can_host_for_business', auth.uid()), (auth.uid(), 'can_manage_fleet', auth.uid())
  on conflict (user_id, capability) do nothing;

  update public.profiles set account_type = case when account_type = 'personal' then 'mixed' else account_type end, updated_at = now() where id = auth.uid();
  return created_business;
end;
$$;

create or replace function public.check_registration_identity(
  registration_email text,
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
  email_match boolean;
  phone_match boolean;
  name_match boolean;
begin
  select exists (select 1 from auth.users where lower(email) = lower(trim(registration_email)) and email_confirmed_at is not null) into email_match;
  select exists (select 1 from public.profiles where normalized_phone is not null and normalized_phone = registration_phone) into phone_match;
  select exists (select 1 from public.profiles where normalized_name = lower(trim(registration_name)) and date_of_birth = registration_date_of_birth) into name_match;
  if email_match and phone_match then return 'CONFIRMED_MATCH'; end if;
  if email_match or phone_match then return 'STRONG_MATCH'; end if;
  if name_match then return 'POSSIBLE_MATCH'; end if;
  return 'NO_MATCH';
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, normalized_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, 'yoRento user'), '@', 1)), lower(trim(new.raw_user_meta_data ->> 'display_name')))
  on conflict (id) do nothing;
  insert into public.user_capabilities (user_id, capability)
  values (new.id, 'can_rent') on conflict (user_id, capability) do nothing;
  insert into public.renter_profiles (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.user_capabilities enable row level security;
alter table public.renter_profiles enable row level security;
alter table public.host_profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_photos enable row level security;
alter table public.vehicle_availability enable row level security;
alter table public.extras enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_extras enable row level security;
alter table public.payment_records enable row level security;
alter table public.reviews enable row level security;
alter table public.verification_records enable row level security;
alter table public.account_merge_candidates enable row level security;
alter table public.audit_logs enable row level security;

create policy "users read their own private profile" on public.profiles for select using (id = auth.uid());
create policy "users update their own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "users read their own capabilities" on public.user_capabilities for select using (user_id = auth.uid());
create policy "users read their own renter profile" on public.renter_profiles for select using (user_id = auth.uid());
create policy "users read their own host profile" on public.host_profiles for select using (user_id = auth.uid());
create policy "published vehicles are searchable" on public.vehicles for select using (status = 'published' or owner_user_id = auth.uid() or public.is_business_member(business_id));
create policy "owners and members manage vehicles" on public.vehicles for all using (owner_user_id = auth.uid() or public.is_business_member(business_id)) with check (owner_user_id = auth.uid() or public.is_business_member(business_id));
create policy "vehicle photos follow vehicle access" on public.vehicle_photos for select using (exists (select 1 from public.vehicles v where v.id = vehicle_id and (v.status = 'published' or public.can_manage_vehicle(v.id))));
create policy "vehicle owners manage photos" on public.vehicle_photos for all using (public.can_manage_vehicle(vehicle_id)) with check (public.can_manage_vehicle(vehicle_id));
create policy "published availability is readable" on public.vehicle_availability for select using (exists (select 1 from public.vehicles v where v.id = vehicle_id and (v.status = 'published' or public.can_manage_vehicle(v.id))));
create policy "vehicle owners manage availability" on public.vehicle_availability for all using (public.can_manage_vehicle(vehicle_id)) with check (public.can_manage_vehicle(vehicle_id));
create policy "business members read businesses" on public.businesses for select using (true);
create policy "business creators manage businesses" on public.businesses for all using (created_by = auth.uid() or public.is_business_member(id)) with check (created_by = auth.uid() or public.is_business_member(id));
create policy "members read memberships" on public.business_members for select using (user_id = auth.uid() or public.is_business_member(business_id));
create policy "business owners manage memberships" on public.business_members for all using (exists (select 1 from public.business_members owner where owner.business_id = business_id and owner.user_id = auth.uid() and owner.role = 'owner')) with check (exists (select 1 from public.business_members owner where owner.business_id = business_id and owner.user_id = auth.uid() and owner.role = 'owner'));
create policy "renters and hosts read bookings" on public.bookings for select using (renter_user_id = auth.uid() or exists (select 1 from public.vehicles v where v.id = vehicle_id and (v.owner_user_id = auth.uid() or public.is_business_member(v.business_id))));
create policy "renters create bookings for themselves" on public.bookings for insert with check (renter_user_id = auth.uid());
create policy "participants update bookings" on public.bookings for update using (renter_user_id = auth.uid() or exists (select 1 from public.vehicles v where v.id = vehicle_id and (v.owner_user_id = auth.uid() or public.is_business_member(v.business_id)))) with check (renter_user_id = auth.uid() or exists (select 1 from public.vehicles v where v.id = vehicle_id and (v.owner_user_id = auth.uid() or public.is_business_member(v.business_id))));
create policy "booking participants read payments" on public.payment_records for select using (payer_user_id = auth.uid() or payee_user_id = auth.uid());
create policy "booking participants read reviews" on public.reviews for select using (author_user_id = auth.uid() or subject_user_id = auth.uid() or exists (select 1 from public.vehicles v where v.id = vehicle_id and v.owner_user_id = auth.uid()));
create policy "verified users read their records" on public.verification_records for select using (user_id = auth.uid() or public.is_business_member(business_id));
create policy "merge candidates are never user readable" on public.account_merge_candidates for select using (false);
create policy "audit logs are never user readable" on public.audit_logs for select using (false);