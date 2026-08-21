import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const [{ data: vehicles }, { data: memberships }] = await Promise.all([
      supabase.from("vehicles").select("*").eq("owner_user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("business_members").select("business_id, role, businesses(*)").eq("user_id", user.id),
    ]);
    const businessIds = (memberships ?? []).map((membership) => membership.business_id);
    const { data: businessVehicles } = businessIds.length ? await supabase.from("vehicles").select("*").in("business_id", businessIds).order("created_at", { ascending: false }) : { data: [] };
    const allVehicles = [...(vehicles ?? []), ...(businessVehicles ?? [])];
    const allVehicleIds = allVehicles.map((vehicle) => vehicle.id);

    // requests and verificationRecords both only depend on allVehicleIds,
    // not on each other — fetch them together instead of one after the other.
    const [{ data: requests }, { data: verificationRecords }] = await Promise.all([
      allVehicleIds.length
        ? supabase.from("bookings").select("*, vehicles(make, model, year)").in("vehicle_id", allVehicleIds).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
      allVehicleIds.length
        ? supabase.from("verification_records").select("vehicle_id, status, created_at").eq("verification_type", "vehicle").in("vehicle_id", allVehicleIds).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as Array<{ vehicle_id: string | null; status: string }> }),
    ]);

    const verificationByVehicle = new Map<string, string>();
    for (const record of verificationRecords ?? []) {
      if (record.vehicle_id && !verificationByVehicle.has(record.vehicle_id)) verificationByVehicle.set(record.vehicle_id, record.status);
    }
    const vehiclesWithVerification = allVehicles.map((vehicle) => ({ ...vehicle, verification_status: verificationByVehicle.get(vehicle.id) ?? "not_started" }));

    // Same for renterProfiles and extraRequests — both only need requests,
    // not each other.
    const renterIds = [...new Set((requests ?? []).map((request) => (request as { renter_user_id: string }).renter_user_id))];
    const bookingIds = (requests ?? []).map((request) => (request as { id: string }).id);
    const [{ data: renterProfiles }, { data: extraRequests }] = await Promise.all([
      renterIds.length ? supabase.from("public_profiles").select("id, display_name").in("id", renterIds) : Promise.resolve({ data: [] as Array<{ id: string; display_name: string }> }),
      bookingIds.length
        ? supabase.from("booking_extras").select("*, extras(name, currency), bookings(vehicles(make, model))").in("booking_id", bookingIds).eq("status", "requested")
        : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    ]);
    const renterNames = new Map((renterProfiles ?? []).map((profile) => [profile.id, profile.display_name]));
    const requestsWithRenter = (requests ?? []).map((request) => ({ ...request, renter_display_name: renterNames.get((request as { renter_user_id: string }).renter_user_id) ?? "Renter" }));

    return NextResponse.json({ vehicles: vehiclesWithVerification, businesses: memberships ?? [], requests: requestsWithRenter, extraRequests: extraRequests ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to load host dashboard." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}
