-- yoRento: a smoking/vaping policy per vehicle, host-chosen at listing
-- time — same shape as fuel_policy/cleaning_policy (0001), a plain
-- text column with a check constraint rather than a new enum type, so
-- it stays consistent with how those two are modeled. Defaults to
-- 'not_allowed' so a host who never touches the field still ends up
-- with an explicit, safe policy on the listing rather than an
-- ambiguous null.
alter table public.vehicles add column if not exists smoking_policy text not null default 'not_allowed'
  check (smoking_policy in ('not_allowed', 'cigarettes_allowed', 'vaping_allowed', 'cigarettes_and_vaping_allowed'));
