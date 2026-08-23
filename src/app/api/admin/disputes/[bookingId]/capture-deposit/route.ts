import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { captureDepositHold } from "@/lib/payments/stripe";
import { capturePaypalAuthorization } from "@/lib/payments/paypal";

const NOTICE_WINDOW_MS = 48 * 60 * 60 * 1000;

// Admin-only, and only reachable once a dispute has been open for the
// notice window — matches the doc's wedge-03 rule ("no charge is made
// until the renter has seen the claim and had a stated window to
// respond"). There's no separate "renter was notified" mechanism this
// pass (see condition report guided-capture plan, phase I) — the
// dispute itself is visible to the renter on /trips the moment it's
// opened, and the 48h gate is the stated window. Never automatic.
export async function POST(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    const { bookingId } = await params;
    const body = await request.json().catch(() => ({})) as { amount?: number };
    const { supabase } = await requireCapability("can_manage_platform");

    const { data: booking, error: bookingError } = await supabase.from("bookings").select("status, updated_at").eq("id", bookingId).single();
    if (bookingError || !booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    if (booking.status !== "disputed") return NextResponse.json({ error: "This booking isn't currently disputed." }, { status: 409 });

    const openedAt = new Date(booking.updated_at).getTime();
    if (Date.now() - openedAt < NOTICE_WINDOW_MS) {
      return NextResponse.json({ error: "This dispute needs to stay open for a 48-hour notice window before a capture." }, { status: 409 });
    }

    const { data: hold, error: holdError } = await supabase.from("payment_records")
      .select("id, provider, currency, amount, processor_reference")
      .eq("booking_id", bookingId).eq("kind", "deposit_hold").eq("status", "authorized").maybeSingle();
    if (holdError || !hold?.processor_reference) return NextResponse.json({ error: "No held deposit found on this booking." }, { status: 404 });

    const captureAmount = body.amount !== undefined && body.amount > 0 && body.amount < Number(hold.amount) ? body.amount : undefined;

    if (hold.provider === "stripe") await captureDepositHold(hold.processor_reference, captureAmount, hold.currency);
    else if (hold.provider === "paypal") await capturePaypalAuthorization(hold.processor_reference, captureAmount, hold.currency);
    else return NextResponse.json({ error: `Captures for ${hold.provider} aren't available yet.` }, { status: 400 });

    const admin = createSupabaseAdminClient();
    if (admin) {
      await admin.from("payment_records").update({
        status: "paid",
        amount: captureAmount ?? hold.amount,
        updated_at: new Date().toISOString(),
      }).eq("id", hold.id);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "CAPABILITY_REQUIRED" ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? "Admin access required." : "Unable to capture the deposit." }, { status });
  }
}
