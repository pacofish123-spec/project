-- yoRento: payments (Stripe + PayPal now, a slot for a DR processor —
-- Azul or CardNet — once a merchant account exists) and identity
-- verification (automated Stripe Identity, with a manual
-- document-upload fallback reviewed through the same admin
-- verification queue already built for vehicles).
--
-- payment_records has existed since 0001, shaped for exactly this: a
-- processor-agnostic ledger row per money movement, with
-- payer_user_id/payee_user_id already able to express both "renter
-- pays platform" (charge) and "platform pays host" (payout) rows. It
-- was just never wired to a real processor. Add what that wiring
-- needs: which provider handled the movement, what kind it is, and a
-- place to keep the provider's own payload for support/debugging.

alter table public.payment_records add column if not exists provider text not null default 'stripe' check (provider in ('stripe', 'paypal', 'azul', 'cardnet'));
alter table public.payment_records add column if not exists kind text not null default 'charge' check (kind in ('charge', 'refund', 'payout'));
alter table public.payment_records add column if not exists metadata jsonb not null default '{}'::jsonb;

drop policy if exists "admins read all payments" on public.payment_records;
create policy "admins read all payments" on public.payment_records for select using (public.is_platform_admin());

-- create_pending_payment: the one write path a renter has into
-- payment_records. Deliberately narrow — it derives the amount and
-- currency from the booking row itself (never from the client), so
-- there is no way to pay a different amount than what the booking
-- actually totals. Only the booking's own renter, and only once the
-- host has accepted, can call it; a booking that's already fully paid
-- can't be paid again.
create or replace function public.create_pending_payment(target_booking_id uuid, target_provider text)
returns public.payment_records
language plpgsql
security definer
set search_path = public
as $$
declare
  target_booking public.bookings;
  result_record public.payment_records;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if target_provider not in ('stripe', 'paypal', 'azul', 'cardnet') then raise exception 'INVALID_PROVIDER'; end if;

  select * into target_booking from public.bookings where id = target_booking_id;
  if target_booking.id is null then raise exception 'BOOKING_NOT_FOUND'; end if;
  if target_booking.renter_user_id <> auth.uid() then raise exception 'BOOKING_ACCESS_DENIED'; end if;
  if target_booking.status <> 'accepted' then raise exception 'BOOKING_NOT_PAYABLE'; end if;

  if exists (select 1 from public.payment_records where booking_id = target_booking_id and kind = 'charge' and status = 'paid') then
    raise exception 'ALREADY_PAID';
  end if;

  insert into public.payment_records (booking_id, payer_user_id, provider, kind, amount, currency, status)
  values (target_booking_id, auth.uid(), target_provider, 'charge', target_booking.total, target_booking.currency, 'pending')
  returning * into result_record;

  return result_record;
end;
$$;

revoke execute on function public.create_pending_payment(uuid, text) from public;
grant execute on function public.create_pending_payment(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Payout accounts: one row per (user, provider) — a Stripe Connect
-- account id, a PayPal payout email, or (later) an Azul/CardNet
-- merchant reference. Its own table rather than columns on
-- host_profiles since a host may eventually hold more than one.
-- ---------------------------------------------------------------------
create table if not exists public.payout_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  provider text not null check (provider in ('stripe', 'paypal', 'azul', 'cardnet')),
  external_account_id text,
  status text not null default 'pending' check (status in ('pending', 'onboarding', 'active', 'restricted', 'disabled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.payout_accounts enable row level security;

drop policy if exists "users manage their own payout accounts" on public.payout_accounts;
create policy "users manage their own payout accounts" on public.payout_accounts for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "admins read all payout accounts" on public.payout_accounts;
create policy "admins read all payout accounts" on public.payout_accounts for select using (public.is_platform_admin());

grant select, insert, update on public.payout_accounts to authenticated;

-- ---------------------------------------------------------------------
-- Identity verification: verification_records already supports
-- verification_type = 'identity' and already has provider /
-- provider_reference columns (0001). The one real gap is nowhere to
-- attach the uploaded document photos for a human reviewer — the same
-- gap vehicles had before photo_paths landed in 0019.
-- ---------------------------------------------------------------------
alter table public.verification_records add column if not exists document_paths text[] not null default '{}';

-- Private bucket — these are government ID photos, never public.
-- Path convention: {user_id}/{filename}, one segment shorter than
-- condition-reports' {booking_id}/{stage}/{filename}.
insert into storage.buckets (id, name, public, file_size_limit)
values ('identity-documents', 'identity-documents', false, 15000000)
on conflict (id) do nothing;

drop policy if exists "users upload their own identity documents" on storage.objects;
create policy "users upload their own identity documents" on storage.objects for insert with check (
  bucket_id = 'identity-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users read their own identity documents" on storage.objects;
create policy "users read their own identity documents" on storage.objects for select using (
  bucket_id = 'identity-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "admins read all identity documents" on storage.objects;
create policy "admins read all identity documents" on storage.objects for select using (
  bucket_id = 'identity-documents' and public.is_platform_admin()
);

-- No update/delete policy — once a document is submitted for review
-- it's evidence, not a draft, mirroring condition-reports.

-- request_identity_verification: mirrors request_vehicle_verification
-- (0024) — one pending record at a time, every platform admin
-- notified immediately so the queue never silently sits unreviewed.
create or replace function public.request_identity_verification(target_document_paths text[])
returns public.verification_records
language plpgsql
security definer
set search_path = public
as $$
declare
  created_record public.verification_records;
  admin_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if target_document_paths is null or array_length(target_document_paths, 1) is null then
    raise exception 'DOCUMENT_REQUIRED';
  end if;

  if exists (
    select 1 from public.verification_records
    where user_id = auth.uid() and verification_type = 'identity' and status in ('pending', 'in_review', 'verified')
  ) then
    raise exception 'VERIFICATION_ALREADY_REQUESTED';
  end if;

  insert into public.verification_records (user_id, verification_type, status, document_paths)
  values (auth.uid(), 'identity', 'pending', target_document_paths)
  returning * into created_record;

  for admin_id in select user_id from public.user_capabilities where capability = 'can_manage_platform' loop
    perform public.notify(
      admin_id,
      'identity_verification_requested',
      'New ID verification request',
      'A renter submitted a government ID for manual review',
      '/admin/verification'
    );
  end loop;

  return created_record;
end;
$$;

revoke execute on function public.request_identity_verification(text[]) from public;
grant execute on function public.request_identity_verification(text[]) to authenticated;

-- start_automated_identity_verification: records that an automated
-- (Stripe Identity) check was started, so the queue and /verify-id
-- both know one is already in flight. The actual verification result
-- is written by the Stripe webhook (via the service-role client, which
-- bypasses RLS by design — see src/lib/supabase/admin.ts), not by this
-- function.
create or replace function public.start_automated_identity_verification(target_provider text, target_provider_reference text)
returns public.verification_records
language plpgsql
security definer
set search_path = public
as $$
declare
  created_record public.verification_records;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;

  if exists (
    select 1 from public.verification_records
    where user_id = auth.uid() and verification_type = 'identity' and status in ('pending', 'in_review', 'verified')
  ) then
    raise exception 'VERIFICATION_ALREADY_REQUESTED';
  end if;

  insert into public.verification_records (user_id, verification_type, status, provider, provider_reference)
  values (auth.uid(), 'identity', 'pending', target_provider, target_provider_reference)
  returning * into created_record;

  return created_record;
end;
$$;

revoke execute on function public.start_automated_identity_verification(text, text) from public;
grant execute on function public.start_automated_identity_verification(text, text) to authenticated;
