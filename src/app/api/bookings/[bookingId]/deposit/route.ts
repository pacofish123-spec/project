import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createDepositHoldSession } from "@/lib/payments/stripe";
import { createDepositAuthOrder } from "@/lib/payments/paypal";
import { convertApprox } from "@/lib/currency";
import { getSiteUrl } from "@/lib/site-url";
import { PLATFORM_DEPOSIT_USD } from "@/lib/platform-policy";

// Mirrors pay/route.ts's shape, but for the optional $300 refundable
// deposit (kind='deposit_hold', migration 0044) rather than the rental
// charge itself — a renter can hold either one, both, or neither (the
// waiver fee is a plain 'charge', handled by the normal pay route).
// Only Stripe and PayPal support the authorize-then-release pattern
// this needs; azul/cardnet aren't offered here even once implemented
// for plain charges, unless they grow the same capability.
export async function POST(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    const { bookingId } = await params;
    const body = await request.json().catch(() => ({})) as { provider?: string };
    const provider = body.provider === "stripe" || body.provider === "paypal" ? body.provider : null;
    if (!provider) return NextResponse.json({ error: "Choose Stripe or PayPal for the deposit hold." }, { status: 400 });

    const { supabase } = await requireUser();
    const { data: booking, error: bookingError } = await supabase.from("bookings").select("currency, vehicles(make, model, year)").eq("id", bookingId).single();
    if (bookingError || !booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

    // The deposit is a flat USD figure — convert to the booking's own
    // currency the same way the pay route converts the other direction
    // for PayPal's DOP gap (see convertApprox usage there).
    let holdAmount = PLATFORM_DEPOSIT_USD;
    let holdCurrency = "USD";
    if (booking.currency !== "USD") {
      const { data: rates } = await supabase.from("currency_rates").select("currency, usd_rate");
      const converted = rates ? convertApprox(PLATFORM_DEPOSIT_USD, "USD", booking.currency, rates) : null;
      if (converted !== null) { holdAmount = converted; holdCurrency = booking.currency; }
    }

    const { data: paymentRecord, error: rpcError } = await supabase.rpc("create_deposit_hold", {
      target_booking_id: bookingId,
      target_provider: provider,
      hold_amount: holdAmount,
      hold_currency: holdCurrency,
    });

    if (rpcError) {
      const reason = rpcError.message ?? "";
      if (reason.includes("BOOKING_ACCESS_DENIED")) return NextResponse.json({ error: "You are not authorized to hold a deposit on this booking." }, { status: 403 });
      if (reason.includes("BOOKING_NOT_PAYABLE")) return NextResponse.json({ error: "This booking isn't ready for a deposit hold yet." }, { status: 409 });
      if (reason.includes("DEPOSIT_ALREADY_HELD")) return NextResponse.json({ error: "A deposit is already held on this booking." }, { status: 409 });
      return NextResponse.json({ error: "Unable to start the deposit hold." }, { status: 500 });
    }

    const siteUrl = getSiteUrl();
    const vehicleLabel = booking.vehicles
      ? `${(booking.vehicles as { make?: string }).make ?? ""} ${(booking.vehicles as { model?: string }).model ?? ""}`.trim()
      : "your yoRento booking";

    const sessionInput = {
      paymentRecordId: paymentRecord.id,
      bookingId,
      amount: holdAmount,
      currency: holdCurrency,
      description: `yoRento refundable deposit — ${vehicleLabel || "your booking"}`,
      successUrl: provider === "paypal"
        ? `${siteUrl}/api/bookings/${bookingId}/deposit/paypal-return?payment_record_id=${paymentRecord.id}`
        : `${siteUrl}/trips?deposit=1`,
      cancelUrl: `${siteUrl}/trips?deposit=0`,
    };

    const session = provider === "paypal" ? await createDepositAuthOrder(sessionInput) : await createDepositHoldSession(sessionInput);

    return NextResponse.json({ redirectUrl: session.redirectUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    if (message === "AUTHENTICATION_REQUIRED") return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    return NextResponse.json({ error: "Unable to start the deposit hold." }, { status: 500 });
  }
}
