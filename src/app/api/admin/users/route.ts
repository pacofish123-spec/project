import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/authorization";

export async function GET() {
  try {
    const { supabase } = await requireCapability("can_manage_platform");

    const [{ data: users, error: usersError }, { data: businesses, error: businessesError }, { data: memberships }] = await Promise.all([
      supabase.rpc("admin_list_users"),
      supabase.from("businesses").select("*").order("created_at", { ascending: false }),
      supabase.from("business_members").select("business_id, user_id, role"),
    ]);

    if (usersError || businessesError) return NextResponse.json({ error: "Unable to load the directory." }, { status: 500 });

    const memberCountByBusiness = new Map<string, number>();
    for (const membership of memberships ?? []) {
      memberCountByBusiness.set(membership.business_id, (memberCountByBusiness.get(membership.business_id) ?? 0) + 1);
    }
    const businessesWithCounts = (businesses ?? []).map((business) => ({ ...business, member_count: memberCountByBusiness.get(business.id) ?? 0 }));

    return NextResponse.json({ users: users ?? [], businesses: businessesWithCounts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "CAPABILITY_REQUIRED" ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? "Admin access required." : "Unable to load the directory." }, { status });
  }
}
