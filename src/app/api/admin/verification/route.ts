import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/authorization";

export async function GET() {
  try {
    const { supabase } = await requireCapability("can_manage_platform");
    const { data, error } = await supabase
      .from("verification_records")
      .select("*, vehicles(*)")
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: "Unable to load verification records." }, { status: 500 });

    const requesterIds = [...new Set((data ?? []).map((record) => record.user_id).filter(Boolean))];
    const { data: requesters } = requesterIds.length
      ? await supabase.from("public_profiles").select("id, display_name").in("id", requesterIds)
      : { data: [] };
    const requesterNames = new Map((requesters ?? []).map((profile) => [profile.id, profile.display_name]));
    const records = (data ?? []).map((record) => ({ ...record, requester_display_name: record.user_id ? requesterNames.get(record.user_id) ?? "—" : "—" }));

    return NextResponse.json({ records });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "CAPABILITY_REQUIRED" ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? "Admin access required." : "Unable to load verification records." }, { status });
  }
}
