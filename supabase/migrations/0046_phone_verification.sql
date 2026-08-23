-- yoRento: phone verification via a one-time code sent over WhatsApp
-- or SMS (whichever channel is actually configured — see
-- src/lib/whatsapp.ts / src/lib/sms.ts). verification_records already
-- allows verification_type = 'phone' (0001) but nothing writes it yet;
-- this table is just the short-lived code exchange that leads there.
-- Codes are hashed at rest (sha256, via pgcrypto's digest) — this table
-- isn't sensitive the way a password table would be, but there's no
-- reason to store a working OTP in plaintext either.
create extension if not exists pgcrypto;

create table public.phone_verification_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  phone text not null,
  code_hash text not null,
  channel text not null check (channel in ('whatsapp', 'sms')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

create index phone_verification_codes_user_idx on public.phone_verification_codes (user_id, created_at desc);

alter table public.phone_verification_codes enable row level security;

-- No direct client access at all — every read/write goes through the
-- two security-definer functions below (send/confirm), never a plain
-- select/insert from the browser, so a hashed code is never even
-- fetchable by anyone but the functions themselves.
revoke all on public.phone_verification_codes from authenticated, anon;

create or replace function public.request_phone_verification_code(target_phone text, target_channel text, target_code_hash text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if target_channel not in ('whatsapp', 'sms') then raise exception 'INVALID_CHANNEL'; end if;

  -- One live code per user at a time — a fresh request invalidates
  -- whatever was sent before, rather than letting old codes linger.
  update public.phone_verification_codes set consumed_at = now()
  where user_id = auth.uid() and consumed_at is null;

  insert into public.phone_verification_codes (user_id, phone, code_hash, channel, expires_at)
  values (auth.uid(), target_phone, target_code_hash, target_channel, now() + interval '10 minutes');
end;
$$;

revoke execute on function public.request_phone_verification_code(text, text, text) from public;
grant execute on function public.request_phone_verification_code(text, text, text) to authenticated;

create or replace function public.confirm_phone_verification_code(submitted_code_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_code public.phone_verification_codes;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;

  select * into target_code from public.phone_verification_codes
  where user_id = auth.uid() and consumed_at is null
  order by created_at desc limit 1;

  if target_code.id is null or target_code.expires_at < now() then raise exception 'CODE_EXPIRED'; end if;
  if target_code.attempts >= 5 then raise exception 'TOO_MANY_ATTEMPTS'; end if;

  update public.phone_verification_codes set attempts = attempts + 1 where id = target_code.id;

  if target_code.code_hash <> submitted_code_hash then return false; end if;

  update public.phone_verification_codes set consumed_at = now() where id = target_code.id;

  -- No unique constraint on (user_id, verification_type) to conflict
  -- against — re-verifying updates the existing row if one exists
  -- rather than accumulating duplicates.
  if exists (select 1 from public.verification_records where user_id = auth.uid() and verification_type = 'phone') then
    update public.verification_records set status = 'verified', provider = target_code.channel, provider_reference = target_code.phone, updated_at = now()
    where user_id = auth.uid() and verification_type = 'phone';
  else
    insert into public.verification_records (user_id, verification_type, status, provider, provider_reference)
    values (auth.uid(), 'phone', 'verified', target_code.channel, target_code.phone);
  end if;

  update public.profiles set phone = target_code.phone, normalized_phone = regexp_replace(target_code.phone, '\D', '', 'g')
  where id = auth.uid() and (phone is null or phone = '');

  return true;
end;
$$;

revoke execute on function public.confirm_phone_verification_code(text) from public;
grant execute on function public.confirm_phone_verification_code(text) to authenticated;
