import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/authorization";

const allowedStatuses = ["requested", "accepted", "declined", "cancelled", "in_progress", "completed", "disputed"] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    const { bookingId } = await params;
    const body = await request.json() as { status?: string; note?: string };
    if (!body.status || !allowedStatuses.includes(body.status as (typeof allowedStatuses)[number])) {
      return NextResponse.json({ error: "Unsupported status." }, { status: 400 });
    }

    const { supabase } = await requireCapability("can_manage_platform");
    const { data, error } = await supabase.rpc("admin_set_booking_status", {
      target_booking_id: bookingId,
      new_status: body.status,
      note: body.note ?? null,
    });

    if (error) {
      const reason = error.message ?? "";
      if (reason.includes("BOOKING_NOT_FOUND")) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
      return NextResponse.json({ error: "Unable to update booking." }, { status: 500 });
    }

    return NextResponse.json({ booking: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "CAPABILITY_REQUIRED" ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? "Admin access required." : "Unable to update booking." }, { status });
  }
}
