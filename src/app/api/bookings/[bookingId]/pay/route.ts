import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";
import { getPaymentProvider } from "@/lib/payments";
import { getSiteUrl } from "@/lib/site-url";
import { convertApprox } from "@/lib/currency";

// Creates a pending payment_records row (amount/currency come straight
// off the booking — never trusted from the client) via
// create_pending_payment, then hands off to the chosen provider to get
// a redirect URL. The renter's browser goes there next; the provider
// tells us how it went via webhook (Stripe) or the return route
// (PayPal).
export async function POST(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    const { bookingId } = await params;
    const body = await request.json().catch(() => ({})) as { provider?: string };
    const provider = getPaymentProvider(body.provider ?? "");
    if (!provider) return NextResponse.json({ error: "Unsupported payment method." }, { status: 400 });
    if (!provider.isConfigured()) return NextResponse.json({ error: "This payment method isn't available yet." }, { status: 400 });

    const { supabase } = await requireUser();
    const { data: booking, error: bookingError } = await supabase.from("bookings").select("total, currency, vehicles(make, model, year)").eq("id", bookingId).single();
    if (bookingError || !booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

    const { data: paymentRecord, error: rpcError } = await supabase.rpc("create_pending_payment", {
      target_booking_id: bookingId,
      target_provider: provider.id,
    });

    if (rpcError) {
      const reason = rpcError.message ?? "";
      if (reason.includes("BOOKING_ACCESS_DENIED")) return NextResponse.json({ error: "You are not authorized to pay for this booking." }, { status: 403 });
      if (reason.includes("BOOKING_NOT_PAYABLE")) return NextResponse.json({ error: "This booking isn't ready to be paid yet — it needs to be accepted by the host first." }, { status: 409 });
      if (reason.includes("ALREADY_PAID")) return NextResponse.json({ error: "This booking has already been paid." }, { status: 409 });
      return NextResponse.json({ error: "Unable to start payment." }, { status: 500 });
    }

    const siteUrl = getSiteUrl();
    const vehicleLabel = booking.vehicles
      ? `${(booking.vehicles as { make?: string }).make ?? ""} ${(booking.vehicles as { model?: string }).model ?? ""}`.trim()
      : "your yoRento booking";

    // payment_records keeps the booking's real total/currency (e.g.
    // DOP) as the source of truth. Some providers can't settle in that
    // currency at all (PayPal has no DOP support — see paypal.ts), so
    // convert what we actually send to checkout, not the debt itself.
    let checkoutAmount = Number(booking.total);
    let checkoutCurrency: string = booking.currency;
    if (provider.supportsCurrency && !provider.supportsCurrency(checkoutCurrency)) {
      const { data: rates } = await supabase.from("currency_rates").select("currency, usd_rate");
      const converted = rates ? convertApprox(checkoutAmount, checkoutCurrency, "USD", rates) : null;
      if (converted === null) {
        return NextResponse.json({ error: `${provider.label} doesn't support payments in ${checkoutCurrency}.` }, { status: 400 });
      }
      checkoutAmount = converted;
      checkoutCurrency = "USD";
    }

    const session = await provider.createCheckoutSession({
      paymentRecordId: paymentRecord.id,
      bookingId,
      amount: checkoutAmount,
      currency: checkoutCurrency,
      description: checkoutCurrency === booking.currency
        ? `yoRento rental — ${vehicleLabel || "your booking"}`
        : `yoRento rental — ${vehicleLabel || "your booking"} (${booking.currency} ${Number(booking.total).toFixed(2)})`,
      successUrl: provider.id === "paypal"
        ? `${siteUrl}/api/bookings/${bookingId}/pay/paypal-return?payment_record_id=${paymentRecord.id}`
        : `${siteUrl}/trips?paid=1`,
      cancelUrl: `${siteUrl}/trips?paid=0`,
    });

    return NextResponse.json({ redirectUrl: session.redirectUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    if (message === "AUTHENTICATION_REQUIRED") return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    return NextResponse.json({ error: "Unable to start payment." }, { status: 500 });
  }
}
