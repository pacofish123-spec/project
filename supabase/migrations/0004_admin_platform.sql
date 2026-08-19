-- yoRento: platform-admin (owner/manager) access.
-- Adds a new capability, can_manage_platform, following the same
-- capability-based model already used for everything else (not a
-- separate account type, not a separate auth system — a relationship
-- attached to one existing user_id, exactly like every other capability).

-- ---------------------------------------------------------------------
-- Widen the user_capabilities CHECK constraint to allow the new value.
-- The constraint was created inline with no explicit name, so this finds
-- whatever Postgres auto-named it rather than assuming the default
-- naming convention, and replaces it.
-- ---------------------------------------------------------------------
do $$
declare
  existing_constraint text;
begin
  select con.conname into existing_constraint
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'user_capabilities'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%capability%';

  if existing_constraint is not null then
    execute format('alter table public.user_capabilities drop constraint %I', existing_constraint);
  end if;
end $$;

alter table public.user_capabilities add constraint user_capabilities_capability_check
  check (capability in ('can_rent', 'can_host_personally', 'can_host_for_business', 'can_manage_business', 'can_manage_fleet', 'can_receive_payouts', 'can_manage_platform'));

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_capabilities
    where user_id = auth.uid() and capability = 'can_manage_platform'
  );
$$;

grant execute on function public.is_platform_admin() to authenticated;

-- Bootstrap: if the operator's own account (identified by email) already
-- exists in this project, grant it platform-admin now so there's no
-- chicken-and-egg problem of needing an admin to create the first admin.
-- If it hasn't signed up yet, this is a no-op — grant it manually later:
--   insert into public.user_capabilities (user_id, capability)
--   values ('<your-user-id-from-auth.users>', 'can_manage_platform');
insert into public.user_capabilities (user_id, capability)
select id, 'can_manage_platform' from auth.users where lower(email) = lower('admin@pakita.shop')
on conflict (user_id, capability) do nothing;

-- ---------------------------------------------------------------------
-- Additive read access for admins. These are extra permissive SELECT
-- policies layered on top of the existing ones (permissive policies OR
-- together in Postgres RLS) — nothing a regular user could already see
-- becomes hidden, admins just gain visibility across every row.
-- ---------------------------------------------------------------------
create policy "platform admins read all profiles" on public.profiles for select using (public.is_platform_admin());
create policy "platform admins read all capabilities" on public.user_capabilities for select using (public.is_platform_admin());
create policy "platform admins read all renter profiles" on public.renter_profiles for select using (public.is_platform_admin());
create policy "platform admins read all host profiles" on public.host_profiles for select using (public.is_platform_admin());
create policy "platform admins read all memberships" on public.business_members for select using (public.is_platform_admin());
create policy "platform admins read all bookings" on public.bookings for select using (public.is_platform_admin());
create policy "platform admins read all verification records" on public.verification_records for select using (public.is_platform_admin());
create policy "platform admins read all merge candidates" on public.account_merge_candidates for select using (public.is_platform_admin());
create policy "platform admins read audit logs" on public.audit_logs for select using (public.is_platform_admin());

-- ---------------------------------------------------------------------
-- Admin write actions all go through security-definer RPCs (same
-- pattern as the rest of the app) rather than broad UPDATE policies, so
-- every admin action is checked, validated, and logged in one place.
-- ---------------------------------------------------------------------
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

  return updated_record;
end;
$$;

grant execute on function public.admin_review_verification(uuid, public.verification_status, text) to authenticated;

create or replace function public.admin_set_booking_status(
  target_booking_id uuid,
  new_status public.booking_status,
  note text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_booking public.bookings;
begin
  if not public.is_platform_admin() then raise exception 'ADMIN_ACCESS_REQUIRED'; end if;

  update public.bookings
  set status = new_status, updated_at = now()
  where id = target_booking_id
  returning * into updated_booking;

  if updated_booking.id is null then raise exception 'BOOKING_NOT_FOUND'; end if;

  insert into public.audit_logs (actor_user_id, event_type, target_type, target_id, metadata)
  values (auth.uid(), 'booking_status_overridden', 'bookings', target_booking_id, jsonb_build_object('new_status', new_status, 'note', note));

  return updated_booking;
end;
$$;

grant execute on function public.admin_set_booking_status(uuid, public.booking_status, text) to authenticated;

-- Duplicate-account review: status transitions only (flagged -> under_review
-- -> verified/rejected/merged). This intentionally does NOT move bookings,
-- vehicles, or reviews between accounts — the spec requires account merges
-- to be reversible with a full audit trail (§5U), which is a materially
-- larger, higher-stakes feature than a review queue. This closes the
-- "review and flag" half of that requirement; the actual data-merge
-- mechanics are a separate future piece of work.
create or replace function public.admin_update_merge_candidate(
  candidate_id uuid,
  new_status text,
  note text default null
)
returns public.account_merge_candidates
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_candidate public.account_merge_candidates;
begin
  if not public.is_platform_admin() then raise exception 'ADMIN_ACCESS_REQUIRED'; end if;
  if new_status not in ('flagged', 'under_review', 'verified', 'rejected', 'merged') then
    raise exception 'INVALID_STATUS';
  end if;

  update public.account_merge_candidates
  set status = new_status, reviewed_by = auth.uid(), reviewed_at = now()
  where id = candidate_id
  returning * into updated_candidate;

  if updated_candidate.id is null then raise exception 'CANDIDATE_NOT_FOUND'; end if;

  insert into public.audit_logs (actor_user_id, event_type, target_type, target_id, metadata)
  values (auth.uid(), 'merge_candidate_reviewed', 'account_merge_candidates', candidate_id, jsonb_build_object('new_status', new_status, 'note', note));

  return updated_candidate;
end;
$$;

grant execute on function public.admin_update_merge_candidate(uuid, text, text) to authenticated;

-- profiles has no email column (by design — email lives in auth.users,
-- which PostgREST doesn't expose). The directory needs it, so this reads
-- auth.users directly inside a security-definer function instead of
-- widening what's exposed to the client schema.
create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  display_name text,
  country_code text,
  account_type public.account_type,
  member_since timestamptz,
  capabilities text[]
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_platform_admin() then raise exception 'ADMIN_ACCESS_REQUIRED'; end if;

  return query
  select
    p.id,
    u.email,
    p.display_name,
    p.country_code,
    p.account_type,
    p.member_since,
    coalesce(array_agg(uc.capability order by uc.capability) filter (where uc.capability is not null), '{}')
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.user_capabilities uc on uc.user_id = p.id
  group by p.id, u.email, p.display_name, p.country_code, p.account_type, p.member_since
  order by p.member_since desc;
end;
$$;

grant execute on function public.admin_list_users() to authenticated;
