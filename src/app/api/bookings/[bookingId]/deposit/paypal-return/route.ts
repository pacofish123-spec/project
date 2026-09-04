import { NextResponse } from "next/server";
import { authorizePaypalOrder } from "@/lib/payments/paypal";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/site-url";

// Same shape as pay/paypal-return/route.ts, but calls authorizePaypalOrder
// (hold) instead of capturePaypalOrder (charge) — see paypal.ts for why
// PayPal's AUTHORIZE intent needs this extra step after buyer approval.
export async function GET(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const url = new URL(request.url);
  const orderId = url.searchParams.get("token");
  const paymentRecordId = url.searchParams.get("payment_record_id");
  const siteUrl = getSiteUrl();

  if (!orderId || !paymentRecordId) {
    return NextResponse.redirect(`${siteUrl}/trips?deposit=0`);
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.redirect(`${siteUrl}/trips?deposit=0`);

  try {
    const result = await authorizePaypalOrder(orderId);
    const authorized = result.status === "COMPLETED" || result.status === "AUTHORIZED" || Boolean(result.authorizationId);
    await admin.from("payment_records").update({
      status: authorized ? "authorized" : "failed",
      processor_reference: result.authorizationId ?? orderId,
      metadata: { paypalOrderId: orderId, paypalStatus: result.status },
      updated_at: new Date().toISOString(),
    }).eq("id", paymentRecordId).eq("booking_id", bookingId);

    return NextResponse.redirect(`${siteUrl}/trips?deposit=${authorized ? "1" : "0"}`);
  } catch {
    await admin.from("payment_records").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", paymentRecordId).eq("booking_id", bookingId);
    return NextResponse.redirect(`${siteUrl}/trips?deposit=0`);
  }
}
