-- yoRento: fix "infinite recursion detected in policy for relation
-- business_members" (Postgres error 42P17) — a real, long-standing bug
-- present since 0001, not something introduced recently. Found live
-- while verifying the vehicle-creation fix: any select against
-- business_members (e.g. AuthMenu's and the host dashboard's "is this
-- person a business member" check) can trip it and fail outright.
--
-- The cause: "business owners manage memberships" is a FOR ALL policy
-- on business_members whose USING/WITH CHECK clause queries
-- business_members itself to check for an 'owner' row. Evaluating that
-- policy re-triggers RLS on business_members, which needs to evaluate
-- the same policy again, and so on — whether this actually recurses
-- forever depends on the query planner's evaluation order for the
-- OR'd policies, which is why it hasn't reliably surfaced before.
--
-- Fix: same pattern already used everywhere else in this schema
-- (is_business_member, can_manage_vehicle, etc.) — move the ownership
-- check into a SECURITY DEFINER function. Run as the function owner,
-- it bypasses RLS on its own internal query entirely, breaking the
-- recursion.
create or replace function public.is_business_owner(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.business_members
    where business_id = target_business_id and user_id = auth.uid() and role = 'owner'
  );
$$;

revoke execute on function public.is_business_owner(uuid) from public;
grant execute on function public.is_business_owner(uuid) to anon, authenticated;

drop policy if exists "business owners manage memberships" on public.business_members;
create policy "business owners manage memberships" on public.business_members
  for all
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));
