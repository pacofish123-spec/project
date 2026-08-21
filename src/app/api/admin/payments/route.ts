import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/authorization";

export async function GET() {
  try {
    const { supabase } = await requireCapability("can_manage_platform");
    const { data, error } = await supabase
      .from("payment_records")
      .select("*, bookings(id, status, vehicles(make, model, year))")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return NextResponse.json({ error: "Unable to load payments." }, { status: 500 });

    const userIds = [...new Set((data ?? []).flatMap((record) => [record.payer_user_id, record.payee_user_id]).filter(Boolean))];
    const { data: profiles } = userIds.length
      ? await supabase.from("public_profiles").select("id, display_name").in("id", userIds)
      : { data: [] };
    const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));

    const records = (data ?? []).map((record) => ({
      ...record,
      payer_display_name: record.payer_user_id ? names.get(record.payer_user_id) ?? "—" : "—",
      payee_display_name: record.payee_user_id ? names.get(record.payee_user_id) ?? "—" : "—",
    }));

    return NextResponse.json({ records });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "CAPABILITY_REQUIRED" ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? "Admin access required." : "Unable to load payments." }, { status });
  }
}
