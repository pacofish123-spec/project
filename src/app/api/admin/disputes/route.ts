import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/authorization";

export async function GET() {
  try {
    const { supabase } = await requireCapability("can_manage_platform");

    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("*, vehicles(make, model, year, host_type)")
      .eq("status", "disputed")
      .order("updated_at", { ascending: false });
    if (error) return NextResponse.json({ error: "Unable to load disputes." }, { status: 500 });

    const bookingIds = (bookings ?? []).map((booking) => booking.id);
    const renterIds = [...new Set((bookings ?? []).map((booking) => booking.renter_user_id))];

    const [{ data: reports }, { data: renters }] = await Promise.all([
      bookingIds.length ? supabase.from("condition_reports").select("*").in("booking_id", bookingIds) : Promise.resolve({ data: [] }),
      renterIds.length ? supabase.from("public_profiles").select("id, display_name").in("id", renterIds) : Promise.resolve({ data: [] }),
    ]);

    const reportsByBooking = new Map<string, typeof reports>();
    for (const report of reports ?? []) {
      const list = reportsByBooking.get(report.booking_id) ?? [];
      list.push(report);
      reportsByBooking.set(report.booking_id, list);
    }
    const renterNames = new Map((renters ?? []).map((profile) => [profile.id, profile.display_name]));

    const disputes = (bookings ?? []).map((booking) => ({
      ...booking,
      renter_display_name: renterNames.get(booking.renter_user_id) ?? "—",
      condition_reports: reportsByBooking.get(booking.id) ?? [],
    }));

    return NextResponse.json({ disputes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "CAPABILITY_REQUIRED" ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? "Admin access required." : "Unable to load disputes." }, { status });
  }
}
