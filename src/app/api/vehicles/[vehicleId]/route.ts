import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ vehicleId: string }> }) {
  try {
    const { vehicleId } = await params;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("vehicles").select("*").eq("id", vehicleId).maybeSingle();
    if (error || !data) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
    return NextResponse.json({ vehicle: data });
  } catch {
    return NextResponse.json({ error: "Unable to load vehicle." }, { status: 500 });
  }
}
