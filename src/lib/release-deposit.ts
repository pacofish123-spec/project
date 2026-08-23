import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { releaseDepositHold } from "@/lib/payments/stripe";
import { voidPaypalAuthorization } from "@/lib/payments/paypal";
import { notifyWhatsApp } from "@/lib/notify-whatsapp";

// Releases any authorized deposit_hold on a booking — never charges,
// only ever cancels/voids the hold. A no-op if there's no active hold.
// Shared by two call sites: a host acknowledging a clean return-stage
// condition report (condition-reports/[reportId]/acknowledge/route.ts),
// and a booking being cancelled outright — no trip happened, so
// there's nothing left to hold a deposit against, and it shouldn't
// have to wait out Stripe's ~7-day / PayPal's ~29-day auto-expiry
// before the renter's card is free again.
//
// Never throws — a release failure (already expired, provider hiccup)
// is logged and left for an admin to sort out from the payments
// queue, not surfaced as a failure of whatever action triggered it.
export async function releaseDepositForBooking(bookingId: string, supabase: SupabaseClient, context: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;

  const { data: hold } = await admin.from("payment_records")
    .select("id, provider, processor_reference, payer_user_id")
    .eq("booking_id", bookingId).eq("kind", "deposit_hold").eq("status", "authorized")
    .maybeSingle();
  if (!hold?.processor_reference) return;

  try {
    if (hold.provider === "stripe") await releaseDepositHold(hold.processor_reference);
    else if (hold.provider === "paypal") await voidPaypalAuthorization(hold.processor_reference);
    else return;
    await admin.from("payment_records").update({ status: "refunded", updated_at: new Date().toISOString() }).eq("id", hold.id);
    if (hold.payer_user_id) notifyWhatsApp(supabase, hold.payer_user_id, "Your yoRento deposit has been released — nothing was charged.");
  } catch (error) {
    console.error(`releaseDepositForBooking failed for booking ${bookingId} (${context}):`, error);
  }
}
