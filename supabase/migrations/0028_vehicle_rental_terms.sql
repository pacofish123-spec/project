-- yoRento: let a host flag which rental lengths they're actually open
-- to (a daily-rate car isn't necessarily available for a one-month
-- rental, and vice versa) so renters can filter for it instead of
-- messaging every host to ask.

alter table public.vehicles add column if not exists rental_terms text[] not null default '{}';

alter table public.vehicles drop constraint if exists vehicles_rental_terms_valid;
alter table public.vehicles add constraint vehicles_rental_terms_valid
  check (rental_terms <@ array['daily', 'weekend', 'weekly', 'monthly', 'long_term']::text[]);
