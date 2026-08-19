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
    const { data: requests } = allVehicleIds.length ? await supabase.from("bookings").select("*, vehicles(make, model, year)").in("vehicle_id", allVehicleIds).order("created_at", { ascending: false }) : { data: [] };

    const renterIds = [...new Set((requests ?? []).map((request) => request.renter_user_id))];
    const { data: renterProfiles } = renterIds.length ? await supabase.from("public_profiles").select("id, display_name").in("id", renterIds) : { data: [] };
    const renterNames = new Map((renterProfiles ?? []).map((profile) => [profile.id, profile.display_name]));
    const requestsWithRenter = (requests ?? []).map((request) => ({ ...request, renter_display_name: renterNames.get(request.renter_user_id) ?? "Renter" }));

    const { data: verificationRecords } = allVehicleIds.length
      ? await supabase.from("verification_records").select("vehicle_id, status, created_at").eq("verification_type", "vehicle").in("vehicle_id", allVehicleIds).order("created_at", { ascending: false })
      : { data: [] };
    const verificationByVehicle = new Map<string, string>();
    for (const record of verificationRecords ?? []) {
      if (record.vehicle_id && !verificationByVehicle.has(record.vehicle_id)) verificationByVehicle.set(record.vehicle_id, record.status);
    }
    const vehiclesWithVerification = allVehicles.map((vehicle) => ({ ...vehicle, verification_status: verificationByVehicle.get(vehicle.id) ?? "not_started" }));

    const bookingIds = (requests ?? []).map((request) => request.id);
    const { data: extraRequests } = bookingIds.length
      ? await supabase.from("booking_extras").select("*, extras(name, currency), bookings(vehicles(make, model))").in("booking_id", bookingIds).eq("status", "requested")
      : { data: [] };

    return NextResponse.json({ vehicles: vehiclesWithVerification, businesses: memberships ?? [], requests: requestsWithRenter, extraRequests: extraRequests ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to load host dashboard." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}