import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";
import { getPaymentProvider } from "@/lib/payments";
import { getSiteUrl } from "@/lib/site-url";

// The other half of the deposit/waiver pay-time choice — a real,
// non-refundable charge (kind='insurance_waiver', migration 0044) at
// whatever rate an admin has actually set (create_insurance_waiver_charge
// refuses to run otherwise). Same shape as pay/route.ts and deposit/route.ts,
// using each provider's normal (capture-on-approval) checkout — there's
// nothing to hold or release here, unlike the deposit.
export async function POST(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    const { bookingId } = await params;
    const body = await request.json().catch(() => ({})) as { provider?: string };
    const provider = body.provider === "stripe" || body.provider === "paypal" ? getPaymentProvider(body.provider) : null;
    if (!provider) return NextResponse.json({ error: "Choose Stripe or PayPal for the waiver fee." }, { status: 400 });
    if (!provider.isConfigured()) return NextResponse.json({ error: "This payment method isn't available yet." }, { status: 400 });

    const { supabase } = await requireUser();
    const { data: booking, error: bookingError } = await supabase.from("bookings").select("vehicles(make, model, year)").eq("id", bookingId).single();
    if (bookingError || !booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

    const { data: paymentRecord, error: rpcError } = await supabase.rpc("create_insurance_waiver_charge", {
      target_booking_id: bookingId,
      target_provider: provider.id,
    });

    if (rpcError) {
      const reason = rpcError.message ?? "";
      if (reason.includes("WAIVER_NOT_AVAILABLE")) return NextResponse.json({ error: "The damage waiver isn't available yet." }, { status: 400 });
      if (reason.includes("BOOKING_ACCESS_DENIED")) return NextResponse.json({ error: "You are not authorized to pay for this booking." }, { status: 403 });
      if (reason.includes("BOOKING_NOT_PAYABLE")) return NextResponse.json({ error: "This booking isn't ready to be paid yet." }, { status: 409 });
      if (reason.includes("WAIVER_ALREADY_CHARGED")) return NextResponse.json({ error: "The waiver fee has already been charged for this booking." }, { status: 409 });
      return NextResponse.json({ error: "Unable to start the waiver charge." }, { status: 500 });
    }

    const siteUrl = getSiteUrl();
    const vehicleLabel = booking.vehicles
      ? `${(booking.vehicles as { make?: string }).make ?? ""} ${(booking.vehicles as { model?: string }).model ?? ""}`.trim()
      : "your yoRento booking";

    const session = await provider.createCheckoutSession({
      paymentRecordId: paymentRecord.id,
      bookingId,
      amount: Number(paymentRecord.amount),
      currency: paymentRecord.currency,
      description: `yoRento damage waiver — ${vehicleLabel || "your booking"}`,
      successUrl: provider.id === "paypal"
        ? `${siteUrl}/api/bookings/${bookingId}/waiver/paypal-return?payment_record_id=${paymentRecord.id}`
        : `${siteUrl}/trips?waiver=1`,
      cancelUrl: `${siteUrl}/trips?waiver=0`,
    });

    return NextResponse.json({ redirectUrl: session.redirectUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    if (message === "AUTHENTICATION_REQUIRED") return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    return NextResponse.json({ error: "Unable to start the waiver charge." }, { status: 500 });
  }
}
