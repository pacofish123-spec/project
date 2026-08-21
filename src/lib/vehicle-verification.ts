import type { SupabaseClient } from "@supabase/supabase-js";

// Shared by every place that lists vehicles publicly (homepage, /search
// API, per-destination pages) and needs to know which ones have passed
// real vehicle verification, so the "Verified" badge is never decorative.
export async function attachVerifiedFlag<T extends { id: string }>(
  supabase: SupabaseClient,
  vehicles: T[],
): Promise<(T & { verified: boolean })[]> {
  const vehicleIds = vehicles.map((vehicle) => vehicle.id);
  const { data: verifiedRecords } = vehicleIds.length
    ? await supabase.from("verification_records").select("vehicle_id").eq("verification_type", "vehicle").eq("status", "verified").in("vehicle_id", vehicleIds)
    : { data: [] as { vehicle_id: string }[] };
  const verifiedVehicleIds = new Set((verifiedRecords ?? []).map((record) => record.vehicle_id));
  return vehicles.map((vehicle) => ({ ...vehicle, verified: verifiedVehicleIds.has(vehicle.id) }));
}
