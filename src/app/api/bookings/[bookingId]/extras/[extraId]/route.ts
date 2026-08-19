import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";

const allowedStatuses = ["accepted", "declined"] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ bookingId: string; extraId: string }> }) {
  try {
    const { bookingId, extraId } = await params;
    const body = await request.json() as { status?: string };
    if (!body.status || !allowedStatuses.includes(body.status as (typeof allowedStatuses)[number])) {
      return NextResponse.json({ error: "Only accept or decline is supported." }, { status: 400 });
    }

    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("respond_to_booking_extra", {
      target_booking_id: bookingId,
      target_extra_id: extraId,
      decision: body.status,
    });

    if (error) {
      const reason = error.message ?? "";
      if (reason.includes("BOOKING_ACCESS_DENIED")) return NextResponse.json({ error: "You are not authorized to manage this booking." }, { status: 403 });
      if (reason.includes("EXTRA_REQUEST_NOT_FOUND") || reason.includes("BOOKING_NOT_FOUND")) return NextResponse.json({ error: "Extra request not found." }, { status: 404 });
      if (reason.includes("EXTRA_ALREADY_RESOLVED")) return NextResponse.json({ error: "This request was already resolved." }, { status: 409 });
      if (reason.includes("EXTRA_OUT_OF_STOCK")) return NextResponse.json({ error: "Not enough of this extra left to accept." }, { status: 409 });
      return NextResponse.json({ error: "Unable to update this extra request." }, { status: 500 });
    }

    return NextResponse.json({ bookingExtra: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to update this extra request." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}
