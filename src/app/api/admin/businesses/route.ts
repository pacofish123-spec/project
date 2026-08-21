import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/authorization";

export async function GET() {
  try {
    const { supabase } = await requireCapability("can_manage_platform");

    const [{ data: businesses, error: businessesError }, { data: members }, { data: vehicles }] = await Promise.all([
      supabase.from("businesses").select("*").order("created_at", { ascending: false }),
      supabase.from("business_members").select("business_id, user_id, role"),
      supabase.from("vehicles").select("id, business_id, status").not("business_id", "is", null),
    ]);
    if (businessesError) return NextResponse.json({ error: "Unable to load businesses." }, { status: 500 });

    const memberIds = [...new Set((members ?? []).map((member) => member.user_id))];
    const { data: memberProfiles } = memberIds.length ? await supabase.from("public_profiles").select("id, display_name").in("id", memberIds) : { data: [] };
    const memberNames = new Map((memberProfiles ?? []).map((profile) => [profile.id, profile.display_name]));

    const membersByBusiness = new Map<string, Array<{ user_id: string; display_name: string; role: string }>>();
    for (const member of members ?? []) {
      const list = membersByBusiness.get(member.business_id) ?? [];
      list.push({ user_id: member.user_id, display_name: memberNames.get(member.user_id) ?? "—", role: member.role });
      membersByBusiness.set(member.business_id, list);
    }

    const vehicleCountByBusiness = new Map<string, { total: number; published: number }>();
    for (const vehicle of vehicles ?? []) {
      const entry = vehicleCountByBusiness.get(vehicle.business_id) ?? { total: 0, published: 0 };
      entry.total += 1;
      if (vehicle.status === "published") entry.published += 1;
      vehicleCountByBusiness.set(vehicle.business_id, entry);
    }

    const result = (businesses ?? []).map((business) => ({
      ...business,
      members: membersByBusiness.get(business.id) ?? [],
      vehicle_count: vehicleCountByBusiness.get(business.id)?.total ?? 0,
      published_vehicle_count: vehicleCountByBusiness.get(business.id)?.published ?? 0,
    }));

    return NextResponse.json({ businesses: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "CAPABILITY_REQUIRED" ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? "Admin access required." : "Unable to load businesses." }, { status });
  }
}
