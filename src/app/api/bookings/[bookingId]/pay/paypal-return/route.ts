import { NextResponse } from "next/server";
import { capturePaypalOrder } from "@/lib/payments/paypal";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/site-url";

// PayPal lands the buyer's browser back here (with ?token=<order id>)
// after they approve on PayPal's side — Checkout Orders need an
// explicit capture call, unlike Stripe Checkout's webhook-driven flow.
// Uses the service-role client the same way the Stripe webhook does:
// there's no user session in this request (it's PayPal's redirect, not
// an authenticated fetch), so the trusted boundary here is "we're the
// ones who initiated this order and PayPal is confirming it", not a
// Supabase auth session.
export async function GET(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const url = new URL(request.url);
  const orderId = url.searchParams.get("token");
  const paymentRecordId = url.searchParams.get("payment_record_id");
  const siteUrl = getSiteUrl();

  if (!orderId || !paymentRecordId) {
    return NextResponse.redirect(`${siteUrl}/trips?paid=0`);
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.redirect(`${siteUrl}/trips?paid=0`);

  try {
    const result = await capturePaypalOrder(orderId);
    const paid = result.status === "COMPLETED";
    await admin.from("payment_records").update({
      status: paid ? "paid" : "failed",
      processor_reference: result.captureId ?? orderId,
      metadata: { paypalOrderId: orderId, paypalStatus: result.status },
      updated_at: new Date().toISOString(),
    }).eq("id", paymentRecordId).eq("booking_id", bookingId);

    return NextResponse.redirect(`${siteUrl}/trips?paid=${paid ? "1" : "0"}`);
  } catch {
    await admin.from("payment_records").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", paymentRecordId).eq("booking_id", bookingId);
    return NextResponse.redirect(`${siteUrl}/trips?paid=0`);
  }
}
