import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { constructStripeWebhookEvent } from "@/lib/payments/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Stripe sends both payment and Identity events to whatever endpoint
// you register, so both are handled here rather than splitting into
// two webhook routes.
//
// Service-role client: this request carries no Supabase session (it's
// a server-to-server call from Stripe, not a browser), so RLS can't be
// satisfied the normal way. The signature check below IS the auth
// boundary — only a request signed with STRIPE_WEBHOOK_SECRET reaches
// the database writes.
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = constructStripeWebhookEvent(rawBody, signature);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Server not configured." }, { status: 500 });

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (!session.client_reference_id) break;
      await admin.from("payment_records").update({
        status: "paid",
        processor_reference: typeof session.payment_intent === "string" ? session.payment_intent : session.id,
        metadata: { stripeSessionId: session.id },
        updated_at: new Date().toISOString(),
      }).eq("id", session.client_reference_id).eq("status", "pending");
      break;
    }
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (!session.client_reference_id) break;
      await admin.from("payment_records").update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", session.client_reference_id).eq("status", "pending");
      break;
    }
    case "identity.verification_session.verified": {
      const session = event.data.object as Stripe.Identity.VerificationSession;
      await admin.from("verification_records").update({ status: "verified", updated_at: new Date().toISOString() })
        .eq("provider", "stripe_identity").eq("provider_reference", session.id);
      break;
    }
    case "identity.verification_session.requires_input": {
      const session = event.data.object as Stripe.Identity.VerificationSession;
      await admin.from("verification_records").update({ status: "requires_information", updated_at: new Date().toISOString() })
        .eq("provider", "stripe_identity").eq("provider_reference", session.id);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
