-- yoRento: VIN-decode verification — the fix for the "BMW E30 listed
-- as seating two" class of bug the wedge audit caught in production.
-- vin is optional (not every host has it handy at listing time); once
-- present, the app layer (src/lib/vin-decode.ts) decodes it against
-- NHTSA's free vPIC API and records the outcome here.
alter table public.vehicles add column if not exists vin text check (vin is null or length(vin) = 17);
alter table public.vehicles add column if not exists vin_verified boolean not null default false;
alter table public.vehicles add column if not exists vin_mismatches text[] not null default '{}';
alter table public.vehicles add column if not exists vin_decoded_at timestamptz;
