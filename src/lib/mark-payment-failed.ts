import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Marks a payment_records row 'failed' after its RPC
// (create_pending_payment / create_deposit_hold /
// create_insurance_waiver_charge) succeeded but the provider call
// that was supposed to follow it (Stripe/PayPal session create)
// didn't. Without this, that row is stuck in 'pending' forever — and
// every one of those RPCs treats a 'pending' row as "already in
// progress" for that booking, permanently blocking every retry with
// no way to clear it except a manual DB fix. Best-effort: uses the
// admin client since a regular user has no update grant on
// payment_records (see 0001's RLS); if even this fails, it's logged
// and left for an admin to sort out.
export async function markPaymentRecordFailed(paymentRecordId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const { error } = await admin.from("payment_records")
    .update({ status: "failed", updated_at: new Date().toISOString() })
    .eq("id", paymentRecordId).eq("status", "pending");
  if (error) console.error(`markPaymentRecordFailed failed for payment_record ${paymentRecordId}:`, error);
}
