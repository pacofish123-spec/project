-- yoRento: link a second email to platform-admin (owner) access.
-- Same pattern as the original bootstrap grant in
-- 0004_admin_platform.sql — a no-op if the account hasn't signed up
-- yet, effective immediately once it has.
insert into public.user_capabilities (user_id, capability)
select id, 'can_manage_platform' from auth.users where lower(email) = lower('johndavida123@hotmail.com')
on conflict (user_id, capability) do nothing;
