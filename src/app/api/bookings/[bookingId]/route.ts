import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";
import { deliverRentalAgreement } from "@/lib/rental-agreement-service";

const allowedStatuses = ["accepted", "declined", "cancelled"] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    const { bookingId } = await params;
    const body = await request.json() as { status?: string };
    if (!body.status || !allowedStatuses.includes(body.status as (typeof allowedStatuses)[number])) {
      return NextResponse.json({ error: "Only accept, decline, or cancel is supported." }, { status: 400 });
    }

    const { supabase } = await requireUser();

    const { data, error } = body.status === "cancelled"
      ? await supabase.rpc("cancel_booking", { target_booking_id: bookingId })
      : await supabase.rpc("respond_to_booking", { target_booking_id: bookingId, decision: body.status });

    if (error) {
      const reason = error.message ?? "";
      if (reason.includes("BOOKING_NOT_FOUND")) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
      if (reason.includes("BOOKING_ACCESS_DENIED")) return NextResponse.json({ error: "You are not authorized to manage this booking." }, { status: 403 });
      if (reason.includes("BOOKING_NOT_PENDING") || reason.includes("BOOKING_NOT_CANCELLABLE")) {
        return NextResponse.json({ error: "This booking is no longer awaiting a decision." }, { status: 409 });
      }
      return NextResponse.json({ error: "Unable to update booking." }, { status: 500 });
    }

    // A booking just went from "requested" to "accepted" — generate and
    // email the rental agreement, and let the guest know it's ready.
    // Never let a failure here (no email provider configured, a PDF
    // error) undo the accept the host just successfully made; it's
    // already committed above.
    if (body.status === "accepted") {
      deliverRentalAgreement(supabase, bookingId).catch((error) => console.error("deliverRentalAgreement error:", error));
    }

    return NextResponse.json({ booking: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to update booking." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}
