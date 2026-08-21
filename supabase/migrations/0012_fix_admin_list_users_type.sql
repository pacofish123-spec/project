-- yoRento: fix admin_list_users() — Postgres error 42804 ("structure of
-- query does not match function result type"). auth.users.email is
-- character varying(255), not text; RETURNS TABLE requires an exact type
-- match, so the function needs an explicit cast. This bug shipped in
-- 0004_admin_platform.sql and was only now actually exercised.
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
    u.email::text,
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
