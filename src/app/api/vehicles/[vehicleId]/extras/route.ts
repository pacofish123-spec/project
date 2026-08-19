import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ vehicleId: string }> }) {
  try {
    const { vehicleId } = await params;
    const supabase = await createSupabaseServerClient();
    const { data: vehicle } = await supabase.from("vehicles").select("owner_user_id, business_id, host_type").eq("id", vehicleId).maybeSingle();
    if (!vehicle) return NextResponse.json({ extras: [] });

    const query = vehicle.host_type === "business" && vehicle.business_id
      ? supabase.from("extras").select("*").eq("business_id", vehicle.business_id).eq("active", true)
      : supabase.from("extras").select("*").eq("owner_user_id", vehicle.owner_user_id).is("business_id", null).eq("active", true);

    const { data, error } = await query.order("created_at", { ascending: true });
    if (error) return NextResponse.json({ error: "Unable to load extras." }, { status: 500 });
    return NextResponse.json({ extras: data });
  } catch {
    return NextResponse.json({ error: "Unable to load extras." }, { status: 500 });
  }
}
