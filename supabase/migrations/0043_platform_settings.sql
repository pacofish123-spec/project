-- yoRento: the first admin-editable platform-wide rate table. Every
-- "rate" in this codebase up to now (tax 0.18, platform fee 0.10 in
-- quote_booking/create_booking) has been a hardcoded PL/pgSQL
-- constant — fine for figures that only ever change with a code
-- deploy, wrong for the insurance damage-waiver rate, which is
-- genuinely unknown until the insurance company sets a number and
-- needs to be flippable without shipping code. Also carries the
-- Casa del Conductor on/off switch (migration 0040-era "scaffold but
-- keep off" decision) so both live in one place an admin can see.
--
-- Singleton via `id boolean primary key default true check (id)` — the
-- standard Postgres one-row-table trick: a second insert would need
-- id = true again, which the primary key already forbids.
create table public.platform_settings (
  id boolean primary key default true check (id),
  insurance_waiver_enabled boolean not null default false,
  insurance_waiver_daily_rate numeric(8,2) check (insurance_waiver_daily_rate is null or insurance_waiver_daily_rate >= 0),
  insurance_waiver_currency text not null default 'USD',
  cdc_membership_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.platform_settings default values;

alter table public.platform_settings enable row level security;

-- Publicly readable — a renter needs to see whether the waiver is on
-- and what it costs, and a listing needs to know whether to render the
-- CDC badge, before they're signed in at all.
create policy "anyone can read platform settings" on public.platform_settings
  for select using (true);

create policy "platform admins update settings" on public.platform_settings
  for update using (public.is_platform_admin());

revoke insert, delete on public.platform_settings from authenticated, anon;
grant select on public.platform_settings to authenticated, anon;
grant update on public.platform_settings to authenticated;
