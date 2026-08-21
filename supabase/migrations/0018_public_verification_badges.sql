-- yoRento: let a *verified* record be publicly readable, so vehicle
-- cards/detail pages can show an honest "Verified" badge to every
-- visitor, not just the record's own owner.
--
-- verification_records currently only allows the record's own user/
-- business member (or a platform admin) to read it at all — correct
-- for pending/failed/in_review rows (that's private review status,
-- nobody else's business), but it also means a vehicle that HAS passed
-- verification can't prove it to a browsing visitor: the whole point of
-- a trust badge is that it's visible to people who aren't the host.
--
-- Fix: add a policy that opens SELECT specifically for status='verified'
-- rows (everything else — pending/failed/in_review/expired/not_started —
-- stays private, so a failed or in-review request is never exposed).
--
-- Deliberately not restricting table-level column grants the way 0017
-- did for public_profiles: the admin verification dashboard already
-- does a plain `select("*")` against this table under the normal
-- RLS-bound client (relying on the existing "platform admins read all
-- verification records" policy), and admins are just authenticated
-- users with a capability flag — a column-level grant can't tell them
-- apart from anyone else. Narrowing columns here would silently break
-- that dashboard. The residual exposure on newly-public *verified* rows
-- is just `provider`/`provider_reference` (an internal reference id,
-- not a credential) — low enough sensitivity to accept in exchange for
-- not risking the admin tool.
create policy "verified records are publicly readable" on public.verification_records
  for select
  using (status = 'verified');
