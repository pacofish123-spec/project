import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";
import { createStripeIdentitySession, isStripeIdentityConfigured } from "@/lib/payments/stripe";
import { getSiteUrl } from "@/lib/site-url";

// Starts an automated Stripe Identity check — document photo + selfie
// liveness match, verified by Stripe rather than a human reviewer.
// Records the attempt via start_automated_identity_verification so the
// same "already in progress" guard applies as the manual path; the
// actual verified/failed result lands later via the Stripe webhook.
export async function POST() {
  try {
    if (!isStripeIdentityConfigured()) return NextResponse.json({ error: "Automated ID verification isn't configured yet." }, { status: 400 });

    const { supabase } = await requireUser();
    const siteUrl = getSiteUrl();
    const session = await createStripeIdentitySession(`${siteUrl}/verify-id?completed=1`);

    const { error: rpcError } = await supabase.rpc("start_automated_identity_verification", {
      target_provider: "stripe_identity",
      target_provider_reference: session.id,
    });
    if (rpcError) {
      const reason = rpcError.message ?? "";
      if (reason.includes("VERIFICATION_ALREADY_REQUESTED")) return NextResponse.json({ error: "You already have an ID verification in progress." }, { status: 409 });
      return NextResponse.json({ error: "Unable to start verification." }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    if (message === "AUTHENTICATION_REQUIRED") return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    return NextResponse.json({ error: "Unable to start verification." }, { status: 500 });
  }
}
