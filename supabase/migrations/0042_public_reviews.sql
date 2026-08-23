-- yoRento: a homepage social-proof feed built from real completed
-- trips — either side (renter or host) can leave one once a booking is
-- 'completed' (the existing "participants review completed bookings"
-- insert policy from 0002 already gates that), and it only ever shows
-- up publicly if the author explicitly opted in. "anyone can read
-- reviews" (0029) already makes every review row readable — that
-- policy is left as-is (it already backs the host-profile reviews
-- list), consent_public is an additional filter the homepage query
-- applies on top, not a new RLS restriction.

alter table public.reviews add column if not exists consent_public boolean not null default false;

-- submit_review: a security-definer wrapper around the existing direct
-- INSERT path so the client never has to (and can't mistakenly) work
-- out subject_user_id/vehicle_id itself — both are derived from the
-- booking server-side. Reuses the exact same "completed booking,
-- either participant" rule the 0002 RLS policy already encodes.
create or replace function public.submit_review(
  target_booking_id uuid,
  p_rating integer,
  p_body text,
  p_consent_public boolean default false
)
returns public.reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  target_booking public.bookings;
  target_vehicle public.vehicles;
  resolved_subject uuid;
  created_review public.reviews;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if p_rating < 1 or p_rating > 5 then raise exception 'INVALID_RATING'; end if;

  select * into target_booking from public.bookings where id = target_booking_id;
  if target_booking.id is null then raise exception 'BOOKING_NOT_FOUND'; end if;
  if target_booking.status <> 'completed' then raise exception 'BOOKING_NOT_COMPLETED'; end if;

  select * into target_vehicle from public.vehicles where id = target_booking.vehicle_id;

  if target_booking.renter_user_id = auth.uid() then
    resolved_subject := target_vehicle.owner_user_id;
  elsif target_vehicle.owner_user_id = auth.uid() then
    resolved_subject := target_booking.renter_user_id;
  else
    raise exception 'BOOKING_ACCESS_DENIED';
  end if;

  if exists (select 1 from public.reviews where booking_id = target_booking_id and author_user_id = auth.uid()) then
    raise exception 'ALREADY_REVIEWED';
  end if;

  insert into public.reviews (booking_id, author_user_id, subject_user_id, vehicle_id, rating, body, consent_public)
  values (target_booking_id, auth.uid(), resolved_subject, target_booking.vehicle_id, p_rating, nullif(trim(coalesce(p_body, '')), ''), coalesce(p_consent_public, false))
  returning * into created_review;

  return created_review;
end;
$$;

revoke execute on function public.submit_review(uuid, integer, text, boolean) from public;
grant execute on function public.submit_review(uuid, integer, text, boolean) to authenticated;
