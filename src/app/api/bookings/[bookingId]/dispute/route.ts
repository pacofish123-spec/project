import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";

export async function POST(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    const { bookingId } = await params;
    const body = await request.json() as { reason?: string };
    if (!body.reason || !body.reason.trim()) return NextResponse.json({ error: "Describe the issue before submitting." }, { status: 400 });

    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("open_dispute", { target_booking_id: bookingId, reason: body.reason });

    if (error) {
      const reason = error.message ?? "";
      if (reason.includes("BOOKING_ACCESS_DENIED")) return NextResponse.json({ error: "You are not authorized to manage this booking." }, { status: 403 });
      if (reason.includes("BOOKING_NOT_DISPUTABLE")) return NextResponse.json({ error: "This booking can't be disputed in its current state." }, { status: 409 });
      if (reason.includes("BOOKING_NOT_FOUND")) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
      return NextResponse.json({ error: "Unable to open a dispute." }, { status: 500 });
    }

    return NextResponse.json({ booking: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to open a dispute." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}
