-- Messaging inbox + push notification subscriptions.
--
-- 1. push_subscriptions: one row per browser/device a user has granted
--    notification permission on (Web Push — a user can have several,
--    e.g. phone + laptop). Server-side sending always goes through the
--    service-role client (it needs to read someone ELSE's
--    subscriptions to push to them), so RLS here only needs to cover
--    the client's own subscribe/unsubscribe calls.
-- 2. get_message_inbox(): one row per booking-thread the caller is a
--    party to (as renter, or as the vehicle's owner/business member),
--    with the other party's identity already resolved (individual
--    host vs business), the latest message, and an unread count — so
--    the messaging widget can render a full inbox in one round trip
--    instead of N+1 queries.
-- 3. Realtime: the messaging widget listens for new rows on messages
--    directly (RLS-scoped per Supabase Realtime's own enforcement), so
--    the table needs to be in the supabase_realtime publication.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "users manage own push subscriptions" on public.push_subscriptions;
create policy "users manage own push subscriptions" on public.push_subscriptions
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.push_subscriptions from public, anon;
grant select, insert, delete on public.push_subscriptions to authenticated;

create or replace function public.get_message_inbox()
returns table (
  booking_id uuid,
  vehicle_id uuid,
  vehicle_make text,
  vehicle_model text,
  vehicle_year integer,
  booking_status public.booking_status,
  is_host boolean,
  other_user_id uuid,
  other_display_name text,
  other_avatar_url text,
  other_is_business boolean,
  last_message_body text,
  last_message_at timestamptz,
  last_message_is_mine boolean,
  unread_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  with my_bookings as (
    select
      b.id as booking_id, b.status, b.vehicle_id, b.renter_user_id,
      v.make, v.model, v.year, v.owner_user_id, v.host_type, v.business_id,
      (b.renter_user_id = auth.uid()) as is_renter
    from public.bookings b
    join public.vehicles v on v.id = b.vehicle_id
    where b.renter_user_id = auth.uid()
       or v.owner_user_id = auth.uid()
       or public.is_business_member(v.business_id)
  ),
  last_msgs as (
    select distinct on (m.booking_id) m.booking_id, m.body, m.created_at, m.sender_user_id
    from public.messages m
    where m.booking_id in (select booking_id from my_bookings)
    order by m.booking_id, m.created_at desc
  ),
  unread as (
    select m.booking_id, count(*)::int as unread_count
    from public.messages m
    where m.booking_id in (select booking_id from my_bookings)
      and m.sender_user_id <> auth.uid()
      and m.read_at is null
    group by m.booking_id
  )
  select
    mb.booking_id,
    mb.vehicle_id,
    mb.make,
    mb.model,
    mb.year,
    mb.status,
    (not mb.is_renter) as is_host,
    case when mb.is_renter then mb.owner_user_id else mb.renter_user_id end,
    case
      when mb.is_renter and mb.host_type = 'business' then biz.name
      when mb.is_renter then prof_host.display_name
      else prof_renter.display_name
    end as other_display_name,
    case
      when mb.is_renter and mb.host_type = 'business' then biz.logo_url
      when mb.is_renter then prof_host.avatar_url
      else prof_renter.avatar_url
    end as other_avatar_url,
    (mb.is_renter and mb.host_type = 'business') as other_is_business,
    lm.body,
    lm.created_at,
    (lm.sender_user_id = auth.uid()),
    coalesce(u.unread_count, 0)
  from my_bookings mb
  left join last_msgs lm on lm.booking_id = mb.booking_id
  left join unread u on u.booking_id = mb.booking_id
  left join public.public_profiles prof_host on prof_host.id = mb.owner_user_id
  left join public.public_profiles prof_renter on prof_renter.id = mb.renter_user_id
  left join public.businesses biz on biz.id = mb.business_id
  where lm.booking_id is not null or mb.status in ('requested', 'accepted', 'in_progress')
  order by coalesce(lm.created_at, '-infinity'::timestamptz) desc;
$$;

revoke all on function public.get_message_inbox() from public, anon;
grant execute on function public.get_message_inbox() to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
