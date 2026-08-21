import { NextResponse } from "next/server";
import { verifyPaypalWebhookSignature } from "@/lib/payments/paypal";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Defense-in-depth alongside the paypal-return route (which already
// captures the order synchronously): this catches cases the return
// trip can miss — the buyer's browser never coming back, a later
// refund or dispute PayPal reports asynchronously. Same service-role
// reasoning as the Stripe webhook: signature verification is the auth
// boundary here, not a Supabase session.
export async function POST(request: Request) {
  const rawBody = await request.text();

  let verified = false;
  try {
    verified = await verifyPaypalWebhookSignature(request.headers, rawBody);
  } catch {
    verified = false;
  }
  if (!verified) return NextResponse.json({ error: "Invalid signature." }, { status: 400 });

  const event = JSON.parse(rawBody) as { event_type?: string; resource?: { id?: string; custom_id?: string; status?: string } };
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Server not configured." }, { status: 500 });

  if (event.event_type === "PAYMENT.CAPTURE.COMPLETED" && event.resource?.custom_id) {
    await admin.from("payment_records").update({ status: "paid", processor_reference: event.resource.id, updated_at: new Date().toISOString() })
      .eq("id", event.resource.custom_id).eq("status", "pending");
  }

  if (event.event_type === "PAYMENT.CAPTURE.REFUNDED" && event.resource?.custom_id) {
    await admin.from("payment_records").update({ status: "refunded", updated_at: new Date().toISOString() })
      .eq("id", event.resource.custom_id);
  }

  return NextResponse.json({ received: true });
}
