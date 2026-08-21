import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";
import { createStripeConnectAccount, createStripeConnectOnboardingLink, getStripeConnectAccountStatus } from "@/lib/payments/stripe";
import { getSiteUrl } from "@/lib/site-url";

// Creates (if needed) a Stripe Connect Express account for the host
// and returns a fresh onboarding link — Stripe's own hosted flow
// collects the bank details and identity info a payout account needs,
// so none of that ever passes through yoRento's own servers.
export async function POST() {
  try {
    const { supabase, user } = await requireUser();

    const { data: existing } = await supabase.from("payout_accounts").select("*").eq("user_id", user.id).eq("provider", "stripe").maybeSingle();
    const { data: profile } = await supabase.from("profiles").select("country_code").eq("id", user.id).single();

    let accountId = existing?.external_account_id ?? null;
    if (!accountId) {
      accountId = await createStripeConnectAccount(user.email, profile?.country_code ?? "US");
      await supabase.from("payout_accounts").upsert(
        { user_id: user.id, provider: "stripe", external_account_id: accountId, status: "onboarding", updated_at: new Date().toISOString() },
        { onConflict: "user_id,provider" },
      );
    }

    const siteUrl = getSiteUrl();
    const url = await createStripeConnectOnboardingLink(accountId, `${siteUrl}/host/payouts?refresh=1`, `${siteUrl}/host/payouts?onboarded=1`);
    return NextResponse.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    if (message === "AUTHENTICATION_REQUIRED") return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    if (message === "STRIPE_NOT_CONFIGURED") return NextResponse.json({ error: "Stripe payouts aren't configured yet." }, { status: 400 });
    return NextResponse.json({ error: "Unable to start Stripe onboarding." }, { status: 500 });
  }
}

// Re-checks the connected account's status after the host returns from
// Stripe's hosted onboarding — Stripe doesn't push that back to us
// synchronously, so the return trip is what triggers the refresh.
export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const { data: existing } = await supabase.from("payout_accounts").select("*").eq("user_id", user.id).eq("provider", "stripe").maybeSingle();
    if (!existing?.external_account_id) return NextResponse.json({ account: null });

    const status = await getStripeConnectAccountStatus(existing.external_account_id);
    const { data: updated } = await supabase.from("payout_accounts")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("user_id", user.id).eq("provider", "stripe")
      .select("*").single();

    return NextResponse.json({ account: updated ?? existing });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    if (message === "AUTHENTICATION_REQUIRED") return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    return NextResponse.json({ error: "Unable to refresh account status." }, { status: 500 });
  }
}
