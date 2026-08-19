import type { Capability, HostType } from "./domain";
import { createSupabaseServerClient } from "./supabase/server";

export async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("AUTHENTICATION_REQUIRED");
  return { supabase, user };
}

export async function requireCapability(capability: Capability) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("user_capabilities")
    .select("capability")
    .eq("user_id", user.id)
    .eq("capability", capability)
    .maybeSingle();

  if (error || !data) throw new Error("CAPABILITY_REQUIRED");
  return { supabase, user };
}

export async function requireVehicleAccess(vehicleId: string, hostType: HostType) {
  const { supabase, user } = await requireUser();
  const { data: vehicle, error } = await supabase
    .from("vehicles")
    .select("id, owner_user_id, business_id, host_type")
    .eq("id", vehicleId)
    .eq("host_type", hostType)
    .maybeSingle();

  if (error || !vehicle) throw new Error("VEHICLE_NOT_FOUND");
  if (vehicle.owner_user_id === user.id) return { supabase, user, vehicle };

  if (!vehicle.business_id) throw new Error("VEHICLE_ACCESS_DENIED");
  const { data: membership } = await supabase
    .from("business_members")
    .select("business_id")
    .eq("business_id", vehicle.business_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) throw new Error("VEHICLE_ACCESS_DENIED");
  return { supabase, user, vehicle };
}