import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/authorization";

export async function GET() {
  try {
    const { supabase } = await requireCapability("can_manage_platform");
    const { data, error } = await supabase
      .from("bookings")
      .select("*, vehicles(make, model, year, host_type)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return NextResponse.json({ error: "Unable to load bookings." }, { status: 500 });

    const renterIds = [...new Set((data ?? []).map((booking) => booking.renter_user_id))];
    const { data: renters } = renterIds.length ? await supabase.from("public_profiles").select("id, display_name").in("id", renterIds) : { data: [] };
    const renterNames = new Map((renters ?? []).map((profile) => [profile.id, profile.display_name]));
    const bookings = (data ?? []).map((booking) => ({ ...booking, renter_display_name: renterNames.get(booking.renter_user_id) ?? "—" }));

    return NextResponse.json({ bookings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "CAPABILITY_REQUIRED" ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? "Admin access required." : "Unable to load bookings." }, { status });
  }
}
