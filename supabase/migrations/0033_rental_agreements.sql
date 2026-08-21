-- yoRento: a rental agreement is generated fresh from the booking's
-- own data every time it's requested (no PDF file is stored) — this
-- table exists only to record that it happened: when it was first
-- generated, whether the email actually sent, and how many times it's
-- been downloaded from the platform. Booking participants can read
-- their own row; every write goes through the service-role client
-- from the booking-accept flow (see src/app/api/bookings/[id]/route.ts),
-- the same trusted-server-context pattern payment webhooks already use.

create table if not exists public.rental_agreements (
  booking_id uuid primary key references public.bookings(id) on delete restrict,
  generated_at timestamptz not null default now(),
  emailed_at timestamptz,
  email_error text,
  download_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.rental_agreements enable row level security;

drop policy if exists "booking participants read their rental agreement status" on public.rental_agreements;
create policy "booking participants read their rental agreement status" on public.rental_agreements for select using (
  exists (
    select 1 from public.bookings b
    where b.id = booking_id
      and (b.renter_user_id = auth.uid() or public.can_manage_vehicle(b.vehicle_id))
  )
);

-- record_agreement_download: the one write a participant can make
-- directly — bumping the download counter when they use the "download
-- from the platform" option. Everything else (generated_at/emailed_at/
-- email_error) is only ever written by the service-role client right
-- after a booking is accepted.
create or replace function public.record_agreement_download(target_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_booking public.bookings;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  select * into target_booking from public.bookings where id = target_booking_id;
  if target_booking.id is null then raise exception 'BOOKING_NOT_FOUND'; end if;
  if not (target_booking.renter_user_id = auth.uid() or public.can_manage_vehicle(target_booking.vehicle_id)) then
    raise exception 'BOOKING_ACCESS_DENIED';
  end if;

  insert into public.rental_agreements (booking_id, download_count)
  values (target_booking_id, 1)
  on conflict (booking_id) do update set download_count = public.rental_agreements.download_count + 1, updated_at = now();
end;
$$;

revoke execute on function public.record_agreement_download(uuid) from public;
grant execute on function public.record_agreement_download(uuid) to authenticated;

-- notify_rental_agreement_ready: fired once, right after a booking is
-- accepted, telling the guest their rental agreement is ready and
-- where to get it. Kept as its own narrow function (rather than folded
-- into respond_to_booking's own notification) so the booking-accept
-- API route controls exactly when it fires, after the PDF/email step
-- actually runs.
create or replace function public.notify_rental_agreement_ready(target_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_booking public.bookings;
begin
  select * into target_booking from public.bookings where id = target_booking_id;
  if target_booking.id is null then raise exception 'BOOKING_NOT_FOUND'; end if;
  if not (target_booking.renter_user_id = auth.uid() or public.can_manage_vehicle(target_booking.vehicle_id)) then
    raise exception 'BOOKING_ACCESS_DENIED';
  end if;

  perform public.notify(
    target_booking.renter_user_id,
    'rental_agreement_ready',
    'Your rental agreement is ready',
    'Check your email, or download it any time from My Trips.',
    '/trips'
  );
end;
$$;

revoke execute on function public.notify_rental_agreement_ready(uuid) from public;
grant execute on function public.notify_rental_agreement_ready(uuid) to authenticated;
