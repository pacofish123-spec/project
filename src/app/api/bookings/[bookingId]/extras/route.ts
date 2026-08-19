import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";

export async function GET(_request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    const { bookingId } = await params;
    const { supabase } = await requireUser();
    const { data, error } = await supabase.from("booking_extras").select("*, extras(name, price, currency)").eq("booking_id", bookingId).order("extra_id");
    if (error) return NextResponse.json({ error: "Unable to load extras for this trip." }, { status: 500 });
    return NextResponse.json({ bookingExtras: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to load extras for this trip." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    const { bookingId } = await params;
    const body = await request.json() as { extraId?: string; quantity?: number; unitPrice?: number };
    if (!body.extraId || !body.unitPrice) return NextResponse.json({ error: "An extra and its price are required." }, { status: 400 });

    const { supabase } = await requireUser();
    // RLS ("renters add extras to their own requested bookings", 0002)
    // enforces ownership, booking status, and that unitPrice matches the
    // extra's real current price server-side — this insert can't be used
    // to smuggle in a different price.
    const { data, error } = await supabase.from("booking_extras").insert({
      booking_id: bookingId,
      extra_id: body.extraId,
      quantity: body.quantity && body.quantity > 0 ? body.quantity : 1,
      unit_price: body.unitPrice,
      status: "requested",
    }).select().single();

    if (error) return NextResponse.json({ error: "Unable to request this extra." }, { status: 400 });
    return NextResponse.json({ bookingExtra: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to request this extra." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}
