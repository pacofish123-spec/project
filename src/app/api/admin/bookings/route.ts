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

    // The real `profiles` table, not the public_profiles view — an
    // admin already has full-row SELECT via is_platform_admin() (0004),
    // and date_of_birth is exactly the kind of field a support agent
    // needs to look a booking up by, which the public view deliberately
    // excludes.
    const renterIds = [...new Set((data ?? []).map((booking) => booking.renter_user_id))];
    const { data: renters } = renterIds.length ? await supabase.from("profiles").select("id, display_name, date_of_birth").in("id", renterIds) : { data: [] };
    const renterById = new Map((renters ?? []).map((profile) => [profile.id, profile]));
    const bookings = (data ?? []).map((booking) => ({
      ...booking,
      renter_display_name: renterById.get(booking.renter_user_id)?.display_name ?? "—",
      renter_date_of_birth: renterById.get(booking.renter_user_id)?.date_of_birth ?? null,
    }));

    return NextResponse.json({ bookings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "CAPABILITY_REQUIRED" ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? "Admin access required." : "Unable to load bookings." }, { status });
  }
}
