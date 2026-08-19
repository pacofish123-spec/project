import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request, { params }: { params: Promise<{ vehicleId: string }> }) {
  try {
    const { vehicleId } = await params;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    if (!startDate || !endDate) return NextResponse.json({ error: "Choose dates first." }, { status: 400 });

    const startsAt = new Date(startDate);
    const endsAt = new Date(endDate);
    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime())) {
      return NextResponse.json({ error: "Choose a valid rental period." }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("quote_booking", {
      p_vehicle_id: vehicleId,
      p_starts_at: startsAt.toISOString(),
      p_ends_at: endsAt.toISOString(),
    });

    if (error) {
      const reason = error.message ?? "";
      if (reason.includes("VEHICLE_NOT_AVAILABLE")) return NextResponse.json({ error: "Vehicle is not available." }, { status: 404 });
      if (reason.includes("INVALID_DATES")) return NextResponse.json({ error: "Choose a valid rental period." }, { status: 400 });
      return NextResponse.json({ error: "Unable to price this trip." }, { status: 500 });
    }

    // quote_booking returns table(...) -> supabase-js gives an array of rows.
    const quote = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ quote });
  } catch {
    return NextResponse.json({ error: "Unable to price this trip." }, { status: 500 });
  }
}
