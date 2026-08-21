import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/authorization";
import { createStripeTransfer } from "@/lib/payments/stripe";
import { createPaypalPayout } from "@/lib/payments/paypal";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Admin-triggered on purpose (not automatic on booking completion) —
// a human confirms the trip actually wrapped up cleanly before money
// leaves the platform. Pays out (total - platform_fee) — the same net
// figure the host dashboard already shows as "your earnings" — to
// whichever payout account the host has set up (Stripe preferred,
// PayPal otherwise).
export async function POST(request: Request) {
  try {
    const body = await request.json() as { bookingId?: string };
    if (!body.bookingId) return NextResponse.json({ error: "bookingId is required." }, { status: 400 });

    const { supabase } = await requireCapability("can_manage_platform");

    const { data: booking, error: bookingError } = await supabase.from("bookings")
      .select("id, status, total, platform_fee, currency, vehicles(owner_user_id)")
      .eq("id", body.bookingId).single();
    if (bookingError || !booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

    const hostUserId = (booking.vehicles as { owner_user_id?: string } | null)?.owner_user_id;
    if (!hostUserId) return NextResponse.json({ error: "This booking has no host to pay out." }, { status: 409 });

    const { data: existingPayout } = await supabase.from("payment_records")
      .select("id").eq("booking_id", booking.id).eq("kind", "payout").eq("status", "paid").maybeSingle();
    if (existingPayout) return NextResponse.json({ error: "This booking has already been paid out." }, { status: 409 });

    const { data: charge } = await supabase.from("payment_records")
      .select("id").eq("booking_id", booking.id).eq("kind", "charge").eq("status", "paid").maybeSingle();
    if (!charge) return NextResponse.json({ error: "This booking hasn't been paid by the renter yet." }, { status: 409 });

    const { data: payoutAccounts } = await supabase.from("payout_accounts").select("*").eq("user_id", hostUserId).in("status", ["active"]);
    const stripeAccount = payoutAccounts?.find((account) => account.provider === "stripe");
    const paypalAccount = payoutAccounts?.find((account) => account.provider === "paypal");

    const netAmount = Number(booking.total) - Number(booking.platform_fee);
    if (netAmount <= 0) return NextResponse.json({ error: "Nothing to pay out — the net amount is zero or less." }, { status: 409 });

    let providerReference: string;
    let provider: "stripe" | "paypal";
    if (stripeAccount?.external_account_id) {
      providerReference = await createStripeTransfer(stripeAccount.external_account_id, netAmount, booking.currency);
      provider = "stripe";
    } else if (paypalAccount?.external_account_id) {
      providerReference = await createPaypalPayout(paypalAccount.external_account_id, netAmount, booking.currency, `yoRento payout for booking ${booking.id}`);
      provider = "paypal";
    } else {
      return NextResponse.json({ error: "This host hasn't set up a payout account yet." }, { status: 409 });
    }

    const admin = createSupabaseAdminClient();
    if (admin) {
      await admin.from("payment_records").insert({
        booking_id: booking.id,
        payee_user_id: hostUserId,
        provider,
        kind: "payout",
        amount: netAmount,
        currency: booking.currency,
        status: "paid",
        processor_reference: providerReference,
      });
    }

    return NextResponse.json({ ok: true, provider, providerReference });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "CAPABILITY_REQUIRED" ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? "Admin access required." : "Unable to send payout." }, { status });
  }
}
