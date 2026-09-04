import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";
import { deliverRentalAgreement } from "@/lib/rental-agreement-service";
import { notifyWhatsApp } from "@/lib/notify-whatsapp";
import { releaseDepositForBooking } from "@/lib/release-deposit";

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

    // A cancelled trip never happens, so any deposit hold placed on it
    // has nothing left to secure — release it immediately rather than
    // making the renter wait out Stripe's ~7-day / PayPal's ~29-day
    // auto-expiry with $300 tied up on their card for no reason.
    if (body.status === "cancelled") {
      releaseDepositForBooking(bookingId, supabase, "booking cancelled").catch((error) => console.error("releaseDepositForBooking error:", error));
    }

    // Best-effort WhatsApp nudge alongside the in-app notification the
    // RPC above already sent — accepted/declined go to the renter,
    // cancelled goes to whoever didn't do the cancelling.
    if (data) {
      const { data: vehicle } = await supabase.from("vehicles").select("make, model, owner_user_id").eq("id", data.vehicle_id).maybeSingle();
      const vehicleLabel = vehicle ? `${vehicle.make} ${vehicle.model}` : "your booking";
      if (body.status === "accepted") notifyWhatsApp(supabase, data.renter_user_id, `Good news — your ${vehicleLabel} booking was accepted. Pay and coordinate pickup in the yoRento app.`);
      else if (body.status === "declined") notifyWhatsApp(supabase, data.renter_user_id, `Your ${vehicleLabel} booking request was declined. Browse other cars in the yoRento app.`);
      else if (body.status === "cancelled" && vehicle) {
        const recipientId = data.renter_user_id; // cancel_booking already enforces only a participant can cancel — notify the vehicle side either way, it's who most often needs the heads-up.
        notifyWhatsApp(supabase, vehicle.owner_user_id === recipientId ? data.renter_user_id : vehicle.owner_user_id, `A ${vehicleLabel} booking was cancelled. Check the yoRento app for details.`);
      }
    }

    return NextResponse.json({ booking: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to update booking." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}
