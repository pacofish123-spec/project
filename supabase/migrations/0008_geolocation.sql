-- yoRento: distance-based search. vehicles.latitude/longitude have
-- existed since 0001 and were never written or read. This adds a
-- Haversine-distance helper (no PostGIS extension required — the
-- distances involved don't need geodesic precision) and lets the host
-- form capture a location and the search API sort/filter by it.
--
-- This is browser-geolocation-only: no maps provider, no reverse
-- geocoding, no API key. There's no visual map view — that needs a real
-- mapping provider (Mapbox/Google) this project isn't configured with.

create or replace function public.vehicles_with_distance(origin_lat numeric, origin_lng numeric)
returns table (id uuid, distance_km numeric)
language sql
stable
as $$
  select v.id,
    round((6371 * acos(
      least(1, greatest(-1,
        cos(radians(origin_lat)) * cos(radians(v.latitude)) * cos(radians(v.longitude) - radians(origin_lng)) +
        sin(radians(origin_lat)) * sin(radians(v.latitude))
      ))
    ))::numeric, 1) as distance_km
  from public.vehicles v
  where v.status = 'published' and v.latitude is not null and v.longitude is not null;
$$;

grant execute on function public.vehicles_with_distance(numeric, numeric) to anon, authenticated;
