-- yoRento: renter <-> host messaging tied to a booking, and an in-app
-- notification center. No email/SMS/push provider is configured in this
-- project, so delivery is in-app only — the notifications table is the
-- right shape to later fan out to a real provider from, but that's a
-- separate integration this migration doesn't attempt to fake.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  sender_user_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (trim(body) <> ''),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists messages_booking_idx on public.messages (booking_id, created_at);

alter table public.messages enable row level security;

drop policy if exists "booking participants read messages" on public.messages;
create policy "booking participants read messages" on public.messages for select using (
  exists (
    select 1 from public.bookings b
    where b.id = booking_id
      and (b.renter_user_id = auth.uid() or exists (
        select 1 from public.vehicles v where v.id = b.vehicle_id
          and (v.owner_user_id = auth.uid() or public.is_business_member(v.business_id))
      ))
  )
);

drop policy if exists "booking participants send messages" on public.messages;
create policy "booking participants send messages" on public.messages for insert with check (
  sender_user_id = auth.uid()
  and exists (
    select 1 from public.bookings b
    where b.id = booking_id
      and (b.renter_user_id = auth.uid() or exists (
        select 1 from public.vehicles v where v.id = b.vehicle_id
          and (v.owner_user_id = auth.uid() or public.is_business_member(v.business_id))
      ))
  )
);

drop policy if exists "platform admins read all messages" on public.messages;
create policy "platform admins read all messages" on public.messages for select using (public.is_platform_admin());

create or replace function public.mark_messages_read(target_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  update public.messages
  set read_at = now()
  where booking_id = target_booking_id and sender_user_id <> auth.uid() and read_at is null
    and exists (
      select 1 from public.bookings b
      where b.id = target_booking_id
        and (b.renter_user_id = auth.uid() or exists (
          select 1 from public.vehicles v where v.id = b.vehicle_id
            and (v.owner_user_id = auth.uid() or public.is_business_member(v.business_id))
        ))
    );
end;
$$;

grant execute on function public.mark_messages_read(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "users read their own notifications" on public.notifications;
create policy "users read their own notifications" on public.notifications for select using (user_id = auth.uid());

-- No insert/update policy for authenticated users: notifications are
-- only ever written by notify() below, called from other trusted
-- SECURITY DEFINER functions — never directly by a client.

create or replace function public.notify(target_user_id uuid, notif_type text, notif_title text, notif_body text default null, notif_link text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_user_id is null then return; end if;
  insert into public.notifications (user_id, type, title, body, link)
  values (target_user_id, notif_type, notif_title, notif_body, notif_link);
end;
$$;

create or replace function public.mark_notification_read(notification_id uuid)
returns public.notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_row public.notifications;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  update public.notifications set read_at = now()
  where id = notification_id and user_id = auth.uid()
  returning * into updated_row;
  if updated_row.id is null then raise exception 'NOTIFICATION_NOT_FOUND'; end if;
  return updated_row;
end;
$$;

grant execute on function public.mark_notification_read(uuid) to authenticated;

create or replace function public.mark_all_notifications_read()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null;
end;
$$;

grant execute on function public.mark_all_notifications_read() to authenticated;

-- A message triggers a notification to whichever participant didn't send it.
create or replace function public.handle_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_booking public.bookings;
  target_vehicle public.vehicles;
  recipient_id uuid;
begin
  select * into target_booking from public.bookings where id = new.booking_id;
  select * into target_vehicle from public.vehicles where id = target_booking.vehicle_id;

  if new.sender_user_id = target_booking.renter_user_id then
    recipient_id := target_vehicle.owner_user_id;
  else
    recipient_id := target_booking.renter_user_id;
  end if;

  if recipient_id is not null and recipient_id <> new.sender_user_id then
    perform public.notify(recipient_id, 'new_message', 'New message', left(new.body, 140), '/trips');
  end if;

  return new;
end;
$$;

drop trigger if exists on_message_created on public.messages;
create trigger on_message_created after insert on public.messages for each row execute procedure public.handle_new_message();

-- ---------------------------------------------------------------------
-- Wire notify() into the existing booking/verification/extras actions.
-- Each function below is unchanged except for the added perform
-- public.notify(...) calls.
-- ---------------------------------------------------------------------
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

create or replace function public.respond_to_booking(target_booking_id uuid, decision text)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  target_booking public.bookings;
  updated_booking public.bookings;
  is_host boolean;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if decision not in ('accepted', 'declined') then raise exception 'INVALID_DECISION'; end if;

  select * into target_booking from public.bookings where id = target_booking_id;
  if target_booking.id is null then raise exception 'BOOKING_NOT_FOUND'; end if;

  select public.can_manage_vehicle(target_booking.vehicle_id) into is_host;
  if not is_host then raise exception 'BOOKING_ACCESS_DENIED'; end if;

  update public.bookings set status = decision::public.booking_status, updated_at = now()
  where id = target_booking_id and status = 'requested'
  returning * into updated_booking;

  if updated_booking.id is null then raise exception 'BOOKING_NOT_PENDING'; end if;

  perform public.notify(
    updated_booking.renter_user_id,
    case when decision = 'accepted' then 'booking_accepted' else 'booking_declined' end,
    case when decision = 'accepted' then 'Booking accepted' else 'Booking declined' end,
    null,
    '/trips'
  );

  return updated_booking;
end;
$$;

create or replace function public.cancel_booking(target_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  target_booking public.bookings;
  updated_booking public.bookings;
  is_renter boolean;
  is_host boolean;
  target_vehicle public.vehicles;
  other_party uuid;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;

  select * into target_booking from public.bookings where id = target_booking_id;
  if target_booking.id is null then raise exception 'BOOKING_NOT_FOUND'; end if;

  is_renter := target_booking.renter_user_id = auth.uid();
  select public.can_manage_vehicle(target_booking.vehicle_id) into is_host;
  if not is_renter and not is_host then raise exception 'BOOKING_ACCESS_DENIED'; end if;

  update public.bookings set status = 'cancelled', updated_at = now()
  where id = target_booking_id and status in ('requested', 'accepted')
  returning * into updated_booking;

  if updated_booking.id is null then raise exception 'BOOKING_NOT_CANCELLABLE'; end if;

  select * into target_vehicle from public.vehicles where id = updated_booking.vehicle_id;
  other_party := case when is_renter then target_vehicle.owner_user_id else updated_booking.renter_user_id end;
  perform public.notify(other_party, 'booking_cancelled', 'Booking cancelled', null, '/trips');

  return updated_booking;
end;
$$;

create or replace function public.respond_to_booking_extra(
  target_booking_id uuid,
  target_extra_id uuid,
  decision text
)
returns public.booking_extras
language plpgsql
security definer
set search_path = public
as $$
declare
  target_booking public.bookings;
  target_extra public.extras;
  current_row public.booking_extras;
  updated_row public.booking_extras;
  booked_count integer;
  line_total numeric(12,2);
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if decision not in ('accepted', 'declined') then raise exception 'INVALID_DECISION'; end if;

  select * into target_booking from public.bookings where id = target_booking_id;
  if target_booking.id is null then raise exception 'BOOKING_NOT_FOUND'; end if;
  if not public.can_manage_vehicle(target_booking.vehicle_id) then raise exception 'BOOKING_ACCESS_DENIED'; end if;

  select * into current_row from public.booking_extras where booking_id = target_booking_id and extra_id = target_extra_id;
  if current_row.booking_id is null then raise exception 'EXTRA_REQUEST_NOT_FOUND'; end if;
  if current_row.status <> 'requested' then raise exception 'EXTRA_ALREADY_RESOLVED'; end if;

  select * into target_extra from public.extras where id = target_extra_id;

  if decision = 'accepted' then
    if target_extra.inventory_count is not null then
      select coalesce(sum(quantity), 0) into booked_count
      from public.booking_extras
      where extra_id = target_extra_id and status = 'accepted';
      if booked_count + current_row.quantity > target_extra.inventory_count then
        raise exception 'EXTRA_OUT_OF_STOCK';
      end if;
    end if;

    line_total := current_row.unit_price * current_row.quantity;
    update public.bookings
    set extras_total = extras_total + line_total, total = total + line_total, updated_at = now()
    where id = target_booking_id;
  end if;

  update public.booking_extras
  set status = decision
  where booking_id = target_booking_id and extra_id = target_extra_id
  returning * into updated_row;

  perform public.notify(
    target_booking.renter_user_id,
    case when decision = 'accepted' then 'extra_accepted' else 'extra_declined' end,
    (case when decision = 'accepted' then 'Extra accepted: ' else 'Extra declined: ' end) || coalesce(target_extra.name, 'extra'),
    null,
    '/trips'
  );

  return updated_row;
end;
$$;

grant execute on function public.respond_to_booking_extra(uuid, uuid, text) to authenticated;

create or replace function public.admin_review_verification(
  record_id uuid,
  new_status public.verification_status,
  note text default null
)
returns public.verification_records
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_record public.verification_records;
begin
  if not public.is_platform_admin() then raise exception 'ADMIN_ACCESS_REQUIRED'; end if;
  if new_status not in ('verified', 'failed', 'requires_information', 'in_review') then
    raise exception 'INVALID_STATUS';
  end if;

  update public.verification_records
  set status = new_status, updated_at = now()
  where id = record_id
  returning * into updated_record;

  if updated_record.id is null then raise exception 'RECORD_NOT_FOUND'; end if;

  insert into public.audit_logs (actor_user_id, event_type, target_type, target_id, metadata)
  values (auth.uid(), 'verification_reviewed', 'verification_records', record_id, jsonb_build_object('new_status', new_status, 'note', note));

  if updated_record.user_id is not null then
    perform public.notify(updated_record.user_id, 'verification_reviewed', 'Verification update: ' || new_status, note, '/host/dashboard');
  end if;

  return updated_record;
end;
$$;

grant execute on function public.admin_review_verification(uuid, public.verification_status, text) to authenticated;
