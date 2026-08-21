-- yoRento: fixes for the Supabase database-linter's latest pass.
--
-- Root cause of the big one (every SECURITY DEFINER function still
-- shows as anon-executable, even ones like create_pending_payment
-- whose own migration already did "revoke execute ... from public"):
-- this Supabase project provisions new functions in the public schema
-- with default privileges that grant EXECUTE directly to anon and
-- authenticated, independent of the Postgres PUBLIC pseudo-role.
-- Every prior migration in this schema (0016 included) only ever
-- revoked from `public` — never from `anon` explicitly — so the
-- actual hole was never closed, no matter how correct the revoke
-- looked. Verified live: anon could reach create_pending_payment's
-- and admin_list_users' function bodies despite both having a
-- "revoke ... from public" already in their own migrations.
--
-- Fix: revoke execute from `public, anon, authenticated` on every
-- SECURITY DEFINER function first (a clean slate, safe/idempotent
-- even where a revoke already happened), then re-grant precisely.
-- Every function below already checks auth.uid()/is_platform_admin()
-- internally, so this closes an access-surface gap (defense in depth)
-- rather than fixing an active exploit — except notify(), which
-- 0016's own investigation found had no internal check at all before
-- that migration restricted its callers to "nothing directly, internal
-- use only" (preserved here).

revoke execute on function public.acknowledge_condition_report(uuid) from public, anon, authenticated;
revoke execute on function public.admin_delete_vehicle(uuid) from public, anon, authenticated;
revoke execute on function public.admin_grant_capability(uuid, text) from public, anon, authenticated;
revoke execute on function public.admin_list_users() from public, anon, authenticated;
revoke execute on function public.admin_review_verification(uuid, public.verification_status, text) from public, anon, authenticated;
revoke execute on function public.admin_revoke_capability(uuid, text) from public, anon, authenticated;
revoke execute on function public.admin_set_booking_status(uuid, public.booking_status, text) from public, anon, authenticated;
revoke execute on function public.admin_set_currency_rate(text, numeric) from public, anon, authenticated;
revoke execute on function public.admin_set_user_status(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.admin_set_vehicle_promotion(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.admin_set_vehicle_status(uuid, text) from public, anon, authenticated;
revoke execute on function public.admin_update_merge_candidate(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.can_manage_vehicle(uuid) from public, anon, authenticated;
revoke execute on function public.can_manage_vehicle_privileged(uuid) from public, anon, authenticated;
revoke execute on function public.cancel_booking(uuid) from public, anon, authenticated;
revoke execute on function public.check_and_flag_oauth_identity(text, text, date) from public, anon, authenticated;
revoke execute on function public.check_registration_identity(text, text, text, date, uuid) from public, anon, authenticated;
revoke execute on function public.create_booking(uuid, timestamptz, timestamptz, text, text) from public, anon, authenticated;
revoke execute on function public.create_business(text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.create_pending_payment(uuid, text) from public, anon, authenticated;
revoke execute on function public.delete_vehicle(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_message() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_business_member(uuid) from public, anon, authenticated;
revoke execute on function public.is_business_owner(uuid) from public, anon, authenticated;
revoke execute on function public.is_platform_admin() from public, anon, authenticated;
revoke execute on function public.mark_all_notifications_read() from public, anon, authenticated;
revoke execute on function public.mark_messages_read(uuid) from public, anon, authenticated;
revoke execute on function public.mark_notification_read(uuid) from public, anon, authenticated;
revoke execute on function public.notify(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.notify_rental_agreement_ready(uuid) from public, anon, authenticated;
revoke execute on function public.open_dispute(uuid, text) from public, anon, authenticated;
revoke execute on function public.publish_vehicle(uuid) from public, anon, authenticated;
revoke execute on function public.quote_booking(uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.record_agreement_download(uuid) from public, anon, authenticated;
revoke execute on function public.request_identity_verification(text[]) from public, anon, authenticated;
revoke execute on function public.request_vehicle_verification(uuid) from public, anon, authenticated;
revoke execute on function public.respond_to_booking(uuid, text) from public, anon, authenticated;
revoke execute on function public.respond_to_booking_extra(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.start_automated_identity_verification(text, text) from public, anon, authenticated;
revoke execute on function public.submit_condition_report(uuid, text, integer, integer, text) from public, anon, authenticated;
revoke execute on function public.submit_condition_report(uuid, text, integer, integer, text, text[]) from public, anon, authenticated;
revoke execute on function public.vehicles_with_distance(numeric, numeric) from public, anon, authenticated;

-- Genuinely public: anonymous browsing/search, pre-signup duplicate
-- checks, or embedded inside RLS policies that anonymous queries
-- evaluate too.
grant execute on function public.is_business_member(uuid) to anon, authenticated;
grant execute on function public.is_business_owner(uuid) to anon, authenticated;
grant execute on function public.can_manage_vehicle(uuid) to anon, authenticated;
grant execute on function public.can_manage_vehicle_privileged(uuid) to anon, authenticated;
grant execute on function public.is_platform_admin() to anon, authenticated;
grant execute on function public.vehicles_with_distance(numeric, numeric) to anon, authenticated;
grant execute on function public.quote_booking(uuid, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.check_registration_identity(text, text, text, date, uuid) to anon, authenticated;

-- Login-required actions — authenticated only.
grant execute on function public.acknowledge_condition_report(uuid) to authenticated;
grant execute on function public.admin_delete_vehicle(uuid) to authenticated;
grant execute on function public.admin_grant_capability(uuid, text) to authenticated;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_review_verification(uuid, public.verification_status, text) to authenticated;
grant execute on function public.admin_revoke_capability(uuid, text) to authenticated;
grant execute on function public.admin_set_booking_status(uuid, public.booking_status, text) to authenticated;
grant execute on function public.admin_set_currency_rate(text, numeric) to authenticated;
grant execute on function public.admin_set_user_status(uuid, text, text) to authenticated;
grant execute on function public.admin_set_vehicle_promotion(uuid, boolean) to authenticated;
grant execute on function public.admin_set_vehicle_status(uuid, text) to authenticated;
grant execute on function public.admin_update_merge_candidate(uuid, text, text) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
grant execute on function public.check_and_flag_oauth_identity(text, text, date) to authenticated;
grant execute on function public.create_booking(uuid, timestamptz, timestamptz, text, text) to authenticated;
grant execute on function public.create_business(text, text, text, text, text) to authenticated;
grant execute on function public.create_pending_payment(uuid, text) to authenticated;
grant execute on function public.delete_vehicle(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.mark_messages_read(uuid) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.notify_rental_agreement_ready(uuid) to authenticated;
grant execute on function public.open_dispute(uuid, text) to authenticated;
grant execute on function public.publish_vehicle(uuid) to authenticated;
grant execute on function public.record_agreement_download(uuid) to authenticated;
grant execute on function public.request_identity_verification(text[]) to authenticated;
grant execute on function public.request_vehicle_verification(uuid) to authenticated;
grant execute on function public.respond_to_booking(uuid, text) to authenticated;
grant execute on function public.respond_to_booking_extra(uuid, uuid, text) to authenticated;
grant execute on function public.start_automated_identity_verification(text, text) to authenticated;
grant execute on function public.submit_condition_report(uuid, text, integer, integer, text) to authenticated;
grant execute on function public.submit_condition_report(uuid, text, integer, integer, text, text[]) to authenticated;

-- Deliberately not re-granted to anyone: notify(), handle_new_user(),
-- handle_new_message() are only ever called from inside other
-- SECURITY DEFINER functions or as trigger bodies, both of which run
-- under the function owner's privileges regardless of these grants —
-- direct RPC access was never intended.

-- ---------------------------------------------------------------------
-- Security Definer View: public_host_profiles. Same fix as 0017 used
-- for public_profiles — host_profiles is never queried directly
-- anywhere in the app (verified), and the view only ever exposed 5
-- non-sensitive aggregate columns, so switching to security_invoker +
-- a narrow column grant + a permissive read policy is a clean,
-- zero-risk fix.
-- ---------------------------------------------------------------------
alter view public.public_host_profiles set (security_invoker = true);

revoke select on public.host_profiles from anon, authenticated;
grant select (user_id, rating, completed_rentals, response_rate, response_time_minutes) on public.host_profiles to anon, authenticated;

drop policy if exists "public host stats are readable" on public.host_profiles;
create policy "public host stats are readable" on public.host_profiles for select using (true);

-- ---------------------------------------------------------------------
-- Security Definer View: public_booking_availability. Unlike
-- host_profiles, `bookings` IS queried directly and broadly by
-- legitimate participants throughout the app (renter_display, host
-- dashboard, /api/bookings, etc. all select many columns off it under
-- the RLS-bound client) — restricting bookings' table-level column
-- grants the way 0017 did for profiles would break that. Converting
-- the view to security_invoker would also require a new permissive
-- row policy on bookings itself, which — without an accompanying
-- column restriction — would let anon read renter identity, price,
-- and pickup/return location directly off the table for every active
-- booking platform-wide. Instead: replace the view with a SECURITY
-- DEFINER function returning the exact same narrow shape (vehicle_id,
-- starts_at, ends_at for active bookings only) — this sidesteps the
-- "Security Definer View" lint rule entirely (it only flags views) and
-- matches this schema's dominant, already-audited access pattern.
-- PostgREST supports the same .select()/.eq()/.lt()/.gt() filtering on
-- a function's RPC endpoint as it does on a view, so the two callers
-- in src/app/api/vehicles/ only need .from(...) swapped for .rpc(...).
-- ---------------------------------------------------------------------
drop view if exists public.public_booking_availability;

create or replace function public.public_booking_availability()
returns table (vehicle_id uuid, starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select vehicle_id, starts_at, ends_at
  from public.bookings
  where status in ('requested', 'accepted', 'in_progress');
$$;

revoke execute on function public.public_booking_availability() from public, anon, authenticated;
grant execute on function public.public_booking_availability() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Public Bucket Allows Listing: vehicle-photos is a PUBLIC bucket —
-- object URLs are served via /storage/v1/object/public/... regardless
-- of any storage.objects RLS policy (verified: src/lib/storage-url.ts
-- builds that URL directly; nothing in the app calls .list() or
-- queries storage.objects for this bucket). The broad "anyone can view
-- vehicle photos" SELECT policy was never needed for that public-URL
-- path — it only ever enabled listing/enumerating every file in the
-- bucket via the objects table/API. Drop it; photos stay exactly as
-- visible as before via their public URL.
-- ---------------------------------------------------------------------
drop policy if exists "anyone can view vehicle photos" on storage.objects;

-- ---------------------------------------------------------------------
-- RLS Policy Always True: page_views' "anyone logs a pageview" INSERT
-- policy. Confirmed intentional (see 0016's own note) — page_views is
-- a write-only pageview log with no SELECT policy for anon/
-- authenticated at all, so a permissive INSERT exposes nothing. No
-- change.
-- ---------------------------------------------------------------------
