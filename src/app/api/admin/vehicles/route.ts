import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/authorization";

export async function GET() {
  try {
    const { supabase } = await requireCapability("can_manage_platform");
    const { data, error } = await supabase
      .from("vehicles")
      .select("*, businesses(name)")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) return NextResponse.json({ error: "Unable to load vehicles." }, { status: 500 });

    const ownerIds = [...new Set((data ?? []).map((vehicle) => vehicle.owner_user_id))];
    const { data: owners } = ownerIds.length ? await supabase.from("public_profiles").select("id, display_name").in("id", ownerIds) : { data: [] };
    const ownerNames = new Map((owners ?? []).map((profile) => [profile.id, profile.display_name]));

    const vehicles = (data ?? []).map((vehicle) => ({ ...vehicle, owner_display_name: ownerNames.get(vehicle.owner_user_id) ?? "—" }));
    return NextResponse.json({ vehicles });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "CAPABILITY_REQUIRED" ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? "Admin access required." : "Unable to load vehicles." }, { status });
  }
}
