-- yoRento: the vehicle detail page needs to show who's renting out
-- the car — a small public host profile (avatar, name, rating,
-- completed rentals) instead of just "Personal owner" text — plus
-- real reviews to back that rating up when a renter taps into it.
--
-- host_profiles itself stays locked to the owning user + admins (it's
-- the same RLS shape renter_profiles/host_profiles have always had);
-- this view exposes only the aggregate stats that were always meant
-- to be public trust signals, mirroring the public_profiles pattern
-- from 0001.
create or replace view public.public_host_profiles as
select user_id, rating, completed_rentals, response_rate, response_time_minutes
from public.host_profiles;
grant select on public.public_host_profiles to anon, authenticated;

-- Reviews were only ever readable by the two participants and the
-- vehicle's owner — meaning the "trust" the vehicle-card star rating
-- implies was never actually backed by anything a browsing visitor
-- could read. A review is feedback meant to inform other renters, the
-- same way it works on every other marketplace; open it up.
drop policy if exists "booking participants read reviews" on public.reviews;
create policy "anyone can read reviews" on public.reviews for select using (true);
