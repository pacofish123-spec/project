-- yoRento: fixes for the Supabase database-linter advisories.
--
-- Context on the big one (anon_security_definer_function_executable):
-- Postgres grants EXECUTE on every new function to the PUBLIC
-- pseudo-role by default, unless it's explicitly revoked. None of this
-- schema's migrations ever ran that revoke — the `grant execute ... to
-- authenticated` statements throughout only ever *added* a grant, they
-- never removed the implicit PUBLIC one. So every function in this
-- schema, including admin-only ones, has always been directly callable
-- by anon over /rest/v1/rpc/<name>. Most were already safe in practice
-- (they check auth.uid() or is_platform_admin() internally and reject
-- anon immediately) — but public.notify() had no check at all: any
-- authenticated user (and, until now, anon too) could POST to
-- /rest/v1/rpc/notify with any target_user_id and inject an arbitrary
-- fake notification — any title, body, and link — into any other
-- user's feed. That's a real phishing vector, not just defense in
-- depth. This migration revokes the default PUBLIC grant everywhere
-- and re-grants only what's actually needed.

-- ---------------------------------------------------------------------
-- function_search_path_mutable: vehicles_with_distance had no fixed
-- search_path.
-- ---------------------------------------------------------------------
create or replace function public.vehicles_with_distance(origin_lat numeric, origin_lng numeric)
returns table (id uuid, distance_km numeric)
language sql
stable
set search_path = public
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

-- ---------------------------------------------------------------------
-- anon_security_definer_function_executable /
-- authenticated_security_definer_function_executable: revoke the
-- implicit PUBLIC grant from every function, then re-grant deliberately.
-- ---------------------------------------------------------------------
revoke execute on function public.acknowledge_condition_report(uuid) from public;
revoke execute on function public.admin_grant_capability(uuid, text) from public;
revoke execute on function public.admin_list_users() from public;
revoke execute on function public.admin_review_verification(uuid, public.verification_status, text) from public;
revoke execute on function public.admin_revoke_capability(uuid, text) from public;
revoke execute on function public.admin_set_booking_status(uuid, public.booking_status, text) from public;
revoke execute on function public.admin_set_currency_rate(text, numeric) from public;
revoke execute on function public.admin_set_user_status(uuid, text, text) from public;
revoke execute on function public.admin_set_vehicle_promotion(uuid, boolean) from public;
revoke execute on function public.admin_set_vehicle_status(uuid, text) from public;
revoke execute on function public.admin_update_merge_candidate(uuid, text, text) from public;
revoke execute on function public.can_manage_vehicle(uuid) from public;
revoke execute on function public.can_manage_vehicle_privileged(uuid) from public;
revoke execute on function public.cancel_booking(uuid) from public;
revoke execute on function public.check_and_flag_oauth_identity(text, text, date) from public;
revoke execute on function public.check_registration_identity(text, text, text, date, uuid) from public;
revoke execute on function public.create_booking(uuid, timestamptz, timestamptz, text, text) from public;
revoke execute on function public.create_business(text, text, text, text, text) from public;
revoke execute on function public.handle_new_message() from public;
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.is_business_member(uuid) from public;
revoke execute on function public.is_platform_admin() from public;
revoke execute on function public.mark_all_notifications_read() from public;
revoke execute on function public.mark_messages_read(uuid) from public;
revoke execute on function public.mark_notification_read(uuid) from public;
revoke execute on function public.notify(uuid, text, text, text, text) from public;
revoke execute on function public.open_dispute(uuid, text) from public;
revoke execute on function public.publish_vehicle(uuid) from public;
revoke execute on function public.quote_booking(uuid, timestamptz, timestamptz) from public;
revoke execute on function public.request_vehicle_verification(uuid) from public;
revoke execute on function public.respond_to_booking(uuid, text) from public;
revoke execute on function public.respond_to_booking_extra(uuid, uuid, text) from public;
revoke execute on function public.submit_condition_report(uuid, text, integer, integer, text) from public;
revoke execute on function public.submit_condition_report(uuid, text, integer, integer, text, text[]) from public;
revoke execute on function public.vehicles_with_distance(numeric, numeric) from public;

-- Genuinely public: anonymous browsing/search, pre-signup checks, or
-- embedded inside RLS policies that anonymous queries evaluate too
-- (e.g. "published vehicles are searchable" is OR'd with
-- is_business_member/is_platform_admin-based admin policies on the
-- same table — anon needs execute on those to run a plain search).
grant execute on function public.is_business_member(uuid) to anon, authenticated;
grant execute on function public.can_manage_vehicle(uuid) to anon, authenticated;
grant execute on function public.can_manage_vehicle_privileged(uuid) to anon, authenticated;
grant execute on function public.is_platform_admin() to anon, authenticated;
grant execute on function public.vehicles_with_distance(numeric, numeric) to anon, authenticated;
grant execute on function public.quote_booking(uuid, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.check_registration_identity(text, text, text, date, uuid) to anon, authenticated;

-- Login-required actions — authenticated only. Each already checks
-- auth.uid() / is_platform_admin() internally; this just closes the
-- anon attack surface as defense in depth on top of that.
grant execute on function public.acknowledge_condition_report(uuid) to authenticated;
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
grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.mark_messages_read(uuid) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.open_dispute(uuid, text) to authenticated;
grant execute on function public.publish_vehicle(uuid) to authenticated;
grant execute on function public.request_vehicle_verification(uuid) to authenticated;
grant execute on function public.respond_to_booking(uuid, text) to authenticated;
grant execute on function public.respond_to_booking_extra(uuid, uuid, text) to authenticated;
grant execute on function public.submit_condition_report(uuid, text, integer, integer, text) to authenticated;
grant execute on function public.submit_condition_report(uuid, text, integer, integer, text, text[]) to authenticated;

-- Deliberately NOT re-granted to anon or authenticated: notify(),
-- handle_new_user(), handle_new_message(). These are only ever called
-- from inside other SECURITY DEFINER functions or as trigger bodies,
-- both of which run under the function owner's privileges regardless
-- of these grants — direct RPC access was never intended, and for
-- notify() specifically was an actual hole (see header comment).

-- ---------------------------------------------------------------------
-- rls_policy_always_true on page_views' INSERT policy: this one is
-- intentional, not a bug. page_views is a write-only pageview log —
-- anonymous visitors (most of the site's traffic) need to be able to
-- log a view, and the table has no SELECT policy for anon/authenticated
-- at all (only "platform admins read page views" does), so a permissive
-- INSERT doesn't expose anything. Left as-is on purpose.
-- ---------------------------------------------------------------------
