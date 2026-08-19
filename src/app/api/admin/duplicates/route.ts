import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/authorization";

export async function GET() {
  try {
    const { supabase } = await requireCapability("can_manage_platform");
    const { data, error } = await supabase.from("account_merge_candidates").select("*").order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: "Unable to load duplicate-account candidates." }, { status: 500 });

    const profileIds = [...new Set((data ?? []).flatMap((row) => [row.canonical_user_id, row.candidate_user_id]).filter(Boolean))];
    const { data: profiles } = profileIds.length ? await supabase.from("public_profiles").select("id, display_name").in("id", profileIds) : { data: [] };
    const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));

    const candidates = (data ?? []).map((row) => ({
      ...row,
      canonical_display_name: row.canonical_user_id ? names.get(row.canonical_user_id) ?? "—" : "—",
      candidate_display_name: row.candidate_user_id ? names.get(row.candidate_user_id) ?? "—" : "—",
    }));

    return NextResponse.json({ candidates });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "CAPABILITY_REQUIRED" ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? "Admin access required." : "Unable to load duplicate-account candidates." }, { status });
  }
}
