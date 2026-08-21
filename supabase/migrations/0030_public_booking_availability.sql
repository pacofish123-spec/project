-- yoRento: bookings has only ever had two read policies — the
-- participants themselves, and admins. That's correct for a booking's
-- real details (renter identity, price, locations), but it also meant
-- there was never a way for a guest, or anyone not party to a
-- specific booking, to see which dates a vehicle is already spoken
-- for. Two real consequences of that gap:
--
-- 1. /api/vehicles' own "exclude vehicles with a date conflict" query
--    reads straight from bookings — for a signed-out visitor (the
--    anon role), RLS silently returns zero rows regardless of real
--    conflicts, so date-based search never actually filtered anything
--    out for a guest.
-- 2. The vehicle detail page's calendar had no way to gray out
--    already-booked days for anyone who isn't the host.
--
-- A public view exposing only what's needed to compute conflicts
-- (which vehicle, which date range, still active) — never the
-- renter's identity, the price, or the locations — fixes both,
-- mirroring the public_profiles / public_host_profiles pattern.
create or replace view public.public_booking_availability as
select vehicle_id, starts_at, ends_at
from public.bookings
where status in ('requested', 'accepted', 'in_progress');
grant select on public.public_booking_availability to anon, authenticated;
