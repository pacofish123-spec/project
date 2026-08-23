import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { releaseDepositHold } from "@/lib/payments/stripe";
import { voidPaypalAuthorization } from "@/lib/payments/paypal";
import { notifyWhatsApp } from "@/lib/notify-whatsapp";

// Releasing a held deposit is a side effect of a clean handshake here,
// not its own user-facing action — see platform-policy.ts / migration
// 0044. Never blocks or fails the acknowledge itself: a release error
// (already expired, provider hiccup) is logged and left for an admin
// to sort out from the payments queue, not surfaced as an acknowledge
// failure the host/renter can't do anything about.
async function releaseDepositIfClean(bookingId: string, ackUserId: string, vehicleId: string, supabase: Awaited<ReturnType<typeof requireUser>>["supabase"]) {
  const { data: canManage } = await supabase.rpc("can_manage_vehicle", { target_vehicle_id: vehicleId });
  if (!canManage) return; // Only a host/vehicle-manager acknowledging a return confirms it's clean.

  const admin = createSupabaseAdminClient();
  if (!admin) return;

  const { data: hold } = await admin.from("payment_records")
    .select("id, provider, processor_reference, payer_user_id")
    .eq("booking_id", bookingId).eq("kind", "deposit_hold").eq("status", "authorized")
    .maybeSingle();
  if (!hold?.processor_reference) return;

  try {
    if (hold.provider === "stripe") await releaseDepositHold(hold.processor_reference);
    else if (hold.provider === "paypal") await voidPaypalAuthorization(hold.processor_reference);
    else return;
    await admin.from("payment_records").update({ status: "refunded", updated_at: new Date().toISOString() }).eq("id", hold.id);
    if (hold.payer_user_id) notifyWhatsApp(supabase, hold.payer_user_id, "Your yoRento deposit has been released — nothing was charged.");
  } catch (error) {
    console.error(`releaseDepositIfClean failed for booking ${bookingId} (acknowledged by ${ackUserId}):`, error);
  }
}

export async function POST(_request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    const { reportId } = await params;
    const { supabase, user } = await requireUser();
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
      if (booking?.vehicle_id) await releaseDepositIfClean(data.booking_id, user.id, booking.vehicle_id, supabase);
    }

    return NextResponse.json({ report: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to acknowledge this report." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}
