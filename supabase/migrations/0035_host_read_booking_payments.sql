-- Hosts (vehicle owner or business co-manager) could not see whether a
-- booking on their own vehicle had actually been paid — the only
-- existing read policy on payment_records is payer_user_id = auth.uid()
-- or payee_user_id = auth.uid(), and create_pending_payment (0027)
-- never sets payee_user_id (money currently lands in the platform's
-- own Stripe balance, paid out separately — see the "separate charges
-- and transfers" note in src/lib/payments/stripe.ts). Add a read path
-- keyed off the booking's vehicle instead, mirroring how
-- /api/host/dashboard already resolves "which vehicles does this user
-- host" (owner_user_id directly, or business_members for a team
-- vehicle). Read-only — nothing about who can write a payment_records
-- row changes.

create policy "vehicle hosts read booking payments" on public.payment_records for select using (
  exists (
    select 1 from public.bookings b
    join public.vehicles v on v.id = b.vehicle_id
    where b.id = payment_records.booking_id
      and (
        v.owner_user_id = auth.uid()
        or exists (
          select 1 from public.business_members bm
          where bm.business_id = v.business_id and bm.user_id = auth.uid()
        )
      )
  )
);
