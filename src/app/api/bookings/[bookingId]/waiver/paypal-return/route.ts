import { NextResponse } from "next/server";
import { capturePaypalOrder } from "@/lib/payments/paypal";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/site-url";

// Identical shape to pay/paypal-return/route.ts — the waiver fee is a
// normal capture, not a hold (unlike deposit/paypal-return/route.ts).
export async function GET(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const url = new URL(request.url);
  const orderId = url.searchParams.get("token");
  const paymentRecordId = url.searchParams.get("payment_record_id");
  const siteUrl = getSiteUrl();

  if (!orderId || !paymentRecordId) {
    return NextResponse.redirect(`${siteUrl}/trips?waiver=0`);
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.redirect(`${siteUrl}/trips?waiver=0`);

  try {
    const result = await capturePaypalOrder(orderId);
    const paid = result.status === "COMPLETED";
    await admin.from("payment_records").update({
      status: paid ? "paid" : "failed",
      processor_reference: result.captureId ?? orderId,
      metadata: { paypalOrderId: orderId, paypalStatus: result.status },
      updated_at: new Date().toISOString(),
    }).eq("id", paymentRecordId).eq("booking_id", bookingId);

    return NextResponse.redirect(`${siteUrl}/trips?waiver=${paid ? "1" : "0"}`);
  } catch {
    await admin.from("payment_records").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", paymentRecordId).eq("booking_id", bookingId);
    return NextResponse.redirect(`${siteUrl}/trips?waiver=0`);
  }
}
