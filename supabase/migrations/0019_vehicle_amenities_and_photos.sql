-- yoRento: two real gaps in the "list your car" flow —
-- 1. There was no way to record anything the car includes beyond air
--    conditioning (has_ac was the only boolean). Add a free-form
--    amenities array so a host can flag Bluetooth, a backup camera, a
--    child seat, etc.
-- 2. There was no photo storage at all — every card/detail page has
--    always shown a generic car icon because there was nowhere for a
--    photo to live. Add photo_paths (object paths in a new public
--    Storage bucket) plus the bucket and its access policies.

alter table public.vehicles add column if not exists amenities text[] not null default '{}';
alter table public.vehicles add column if not exists photo_paths text[] not null default '{}';

-- Public bucket (not signed-URL-gated like condition-reports) — these
-- are marketing photos meant to be visible to every browsing visitor,
-- the same as any other listing image, so plain public URLs are the
-- right fit rather than paying for a signed-URL round trip on every
-- card render.
insert into storage.buckets (id, name, public)
values ('vehicle-photos', 'vehicle-photos', true)
on conflict (id) do nothing;

-- Path convention: {vehicle_id}/{filename} — mirrors the
-- condition-reports bucket's {booking_id}/{stage}/{filename}
-- convention, just one segment shorter.
drop policy if exists "anyone can view vehicle photos" on storage.objects;
create policy "anyone can view vehicle photos" on storage.objects for select using (
  bucket_id = 'vehicle-photos'
);

drop policy if exists "vehicle managers upload vehicle photos" on storage.objects;
create policy "vehicle managers upload vehicle photos" on storage.objects for insert with check (
  bucket_id = 'vehicle-photos'
  and public.can_manage_vehicle(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "vehicle managers delete vehicle photos" on storage.objects;
create policy "vehicle managers delete vehicle photos" on storage.objects for delete using (
  bucket_id = 'vehicle-photos'
  and public.can_manage_vehicle(((storage.foldername(name))[1])::uuid)
);
