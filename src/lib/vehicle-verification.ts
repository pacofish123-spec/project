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

// Same idea, but for the host's own identity (verification_type =
// 'identity', keyed by owner_user_id rather than vehicle_id) — a
// separate trust signal from the vehicle badge above: the vehicle
// listing was reviewed, and/or the person renting it out has passed ID
// verification. Both can be true, either can be true alone.
export async function attachHostIdentityVerifiedFlag<T extends { owner_user_id: string }>(
  supabase: SupabaseClient,
  vehicles: T[],
): Promise<(T & { host_identity_verified: boolean })[]> {
  const ownerIds = [...new Set(vehicles.map((vehicle) => vehicle.owner_user_id))];
  const { data: verifiedRecords } = ownerIds.length
    ? await supabase.from("verification_records").select("user_id").eq("verification_type", "identity").eq("status", "verified").in("user_id", ownerIds)
    : { data: [] as { user_id: string }[] };
  const verifiedOwnerIds = new Set((verifiedRecords ?? []).map((record) => record.user_id));
  return vehicles.map((vehicle) => ({ ...vehicle, host_identity_verified: verifiedOwnerIds.has(vehicle.owner_user_id) }));
}

// Convenience for the common case (homepage, /search, per-destination
// pages, /api/vehicles): both trust badges in a single pass.
export async function attachTrustBadges<T extends { id: string; owner_user_id: string }>(
  supabase: SupabaseClient,
  vehicles: T[],
): Promise<(T & { verified: boolean; host_identity_verified: boolean })[]> {
  const withVerified = await attachVerifiedFlag(supabase, vehicles);
  return attachHostIdentityVerifiedFlag(supabase, withVerified);
}
