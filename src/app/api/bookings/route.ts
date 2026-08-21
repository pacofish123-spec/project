import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/authorization";

interface BookingInput {
  vehicleId?: string;
  startsAt?: string;
  endsAt?: string;
  pickupLocation?: string;
  returnLocation?: string;
}

export async function GET() {
  try {
    const { supabase, user } = await requireCapability("can_rent");
    const { data, error } = await supabase.from("bookings").select("*, vehicles(make, model, year, location_city, host_type, photo_paths), payment_records(status, kind, provider)").eq("renter_user_id", user.id).order("starts_at", { ascending: false });
    if (error) return NextResponse.json({ error: "Unable to load trips." }, { status: 500 });
    return NextResponse.json({ bookings: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to load trips." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as BookingInput;
    if (!body.vehicleId || !body.startsAt || !body.endsAt || !body.pickupLocation || !body.returnLocation) {
      return NextResponse.json({ error: "Booking details are missing." }, { status: 400 });
    }

    const startsAt = new Date(body.startsAt);
    const endsAt = new Date(body.endsAt);
    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime())) {
      return NextResponse.json({ error: "Choose a valid rental period." }, { status: 400 });
    }

    const { supabase } = await requireCapability("can_rent");

    // Price, availability, and status are all computed and validated
    // server-side inside create_booking() — the client only supplies
    // which vehicle and dates it wants. See migration 0003.
    const { data: booking, error } = await supabase.rpc("create_booking", {
      p_vehicle_id: body.vehicleId,
      p_starts_at: startsAt.toISOString(),
      p_ends_at: endsAt.toISOString(),
      p_pickup_location: body.pickupLocation,
      p_return_location: body.returnLocation,
    });

    if (error) {
      const reason = error.message ?? "";
      if (reason.includes("ACCOUNT_SUSPENDED")) return NextResponse.json({ error: "Your account is suspended and can't book right now." }, { status: 403 });
      if (reason.includes("VEHICLE_NOT_AVAILABLE")) return NextResponse.json({ error: "Vehicle is not available." }, { status: 404 });
      if (reason.includes("DATES_UNAVAILABLE")) return NextResponse.json({ error: "Those dates are no longer available." }, { status: 409 });
      if (reason.includes("INVALID_DATES") || reason.includes("LOCATIONS_REQUIRED")) return NextResponse.json({ error: "Choose a valid rental period." }, { status: 400 });
      return NextResponse.json({ error: "Unable to create booking request." }, { status: 500 });
    }

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "CAPABILITY_REQUIRED" ? 403 : 500;
    return NextResponse.json({ error: "Unable to create booking request." }, { status });
  }
}
