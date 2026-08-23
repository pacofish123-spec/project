import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";
import { releaseDepositForBooking } from "@/lib/release-deposit";

// Releasing a held deposit is a side effect of a clean handshake here,
// not its own user-facing action — see platform-policy.ts / migration
// 0044. The actual release call is shared with the booking-cancellation
// path (see release-deposit.ts) — this wrapper just adds the
// "acknowledging party has to actually be the host/vehicle-manager"
// gate, which is specific to what "clean" means here and doesn't apply
// to the cancellation call site.
async function releaseDepositIfClean(bookingId: string, vehicleId: string, supabase: Awaited<ReturnType<typeof requireUser>>["supabase"]) {
  const { data: canManage } = await supabase.rpc("can_manage_vehicle", { target_vehicle_id: vehicleId });
  if (!canManage) return; // Only a host/vehicle-manager acknowledging a return confirms it's clean.
  await releaseDepositForBooking(bookingId, supabase, "return-stage condition report acknowledged");
}

export async function POST(_request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    const { reportId } = await params;
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("acknowledge_condition_report", { report_id: reportId });

    if (error) {
      const reason = error.message ?? "";
      if (reason.includes("CANNOT_ACKNOWLEDGE_OWN_REPORT")) return NextResponse.json({ error: "You can't acknowledge your own report — the other party needs to." }, { status: 409 });
      if (reason.includes("BOOKING_ACCESS_DENIED")) return NextResponse.json({ error: "You are not authorized to manage this booking." }, { status: 403 });
      if (reason.includes("REPORT_NOT_FOUND")) return NextResponse.json({ error: "Report not found." }, { status: 404 });
      return NextResponse.json({ error: "Unable to acknowledge this report." }, { status: 500 });
    }

    if (data?.stage === "return" && data.booking_id) {
      const { data: booking } = await supabase.from("bookings").select("vehicle_id").eq("id", data.booking_id).maybeSingle();
      if (booking?.vehicle_id) await releaseDepositIfClean(data.booking_id, booking.vehicle_id, supabase);
    }

    return NextResponse.json({ report: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to acknowledge this report." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}
