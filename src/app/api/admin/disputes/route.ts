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

    const [{ data: reports }, { data: renters }, { data: deposits }] = await Promise.all([
      bookingIds.length ? supabase.from("condition_reports").select("*").in("booking_id", bookingIds) : Promise.resolve({ data: [] }),
      renterIds.length ? supabase.from("profiles").select("id, display_name, date_of_birth").in("id", renterIds) : Promise.resolve({ data: [] }),
      bookingIds.length ? supabase.from("payment_records").select("*").in("booking_id", bookingIds).eq("kind", "deposit_hold").eq("status", "authorized") : Promise.resolve({ data: [] }),
    ]);

    const reportsByBooking = new Map<string, typeof reports>();
    for (const report of reports ?? []) {
      const list = reportsByBooking.get(report.booking_id) ?? [];
      list.push(report);
      reportsByBooking.set(report.booking_id, list);
    }
    const renterById = new Map((renters ?? []).map((profile) => [profile.id, profile]));
    const depositByBooking = new Map((deposits ?? []).map((deposit) => [deposit.booking_id, deposit]));

    const disputes = (bookings ?? []).map((booking) => ({
      ...booking,
      renter_display_name: renterById.get(booking.renter_user_id)?.display_name ?? "—",
      renter_date_of_birth: renterById.get(booking.renter_user_id)?.date_of_birth ?? null,
      condition_reports: reportsByBooking.get(booking.id) ?? [],
      // The held deposit for this booking, if any — captureable from
      // the admin UI once the dispute has been open long enough (see
      // capture-deposit/route.ts). booking.updated_at is the best
      // available proxy for "when this went disputed" (open_dispute
      // sets status='disputed' on the same row, and nothing else in
      // this codebase routinely touches a disputed booking afterward).
      held_deposit: depositByBooking.get(booking.id) ?? null,
    }));

    return NextResponse.json({ disputes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "CAPABILITY_REQUIRED" ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? "Admin access required." : "Unable to load disputes." }, { status });
  }
}
