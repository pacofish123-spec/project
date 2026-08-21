-- yoRento: fix the "Security Definer View" advisory (ERROR level) on
-- public.public_profiles.
--
-- Context: views created against a plain Postgres role default to
-- security_invoker = false, i.e. they run with the view *owner's*
-- privileges rather than the querying user's — which silently bypasses
-- RLS on the underlying table. public_profiles has been doing that
-- since it was created in 0001: it only ever selects 5 non-sensitive
-- columns (id, display_name, avatar_url, country_code, member_since),
-- so nothing sensitive has actually leaked through it, but the
-- mechanism is wrong — it ignores RLS entirely rather than being
-- scoped by it, so a future edit that adds a column to the view would
-- leak it with zero RLS protection and no warning.
--
-- Fix: switch the view to security_invoker = true (so it's bound by
-- RLS like any normal client query), add a row-permissive SELECT
-- policy on profiles so the view can still return other users' basic
-- info (needed for host/renter name+avatar on vehicle cards, bookings,
-- messages, disputes, etc.), but lock down *table-level* column grants
-- on public.profiles so anon/authenticated can only ever select the
-- same 5 safe columns directly — phone, normalized_phone,
-- normalized_name, and date_of_birth stay unreachable via
-- /rest/v1/profiles no matter which RLS policy matches the row.
--
-- Everything that touches those sensitive columns already goes through
-- either an UPDATE (unaffected — this migration only revokes SELECT)
-- or a SECURITY DEFINER function (unaffected — those run as the
-- function owner, not as anon/authenticated, so table grants on the
-- caller's role don't apply to them). Verified: no code in the app
-- selects phone/date_of_birth/normalized_name/normalized_phone
-- directly off public.profiles.

alter view public.public_profiles set (security_invoker = true);

revoke select on public.profiles from anon, authenticated;
grant select (id, display_name, avatar_url, country_code, member_since) on public.profiles to anon, authenticated;

create policy "public profile fields are readable" on public.profiles
  for select
  using (true);
