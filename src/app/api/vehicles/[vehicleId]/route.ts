import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/authorization";

export async function GET(_request: Request, { params }: { params: Promise<{ vehicleId: string }> }) {
  try {
    const { vehicleId } = await params;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("vehicles").select("*").eq("id", vehicleId).maybeSingle();
    if (error || !data) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });

    const { data: verificationRecord } = await supabase
      .from("verification_records")
      .select("id")
      .eq("vehicle_id", vehicleId)
      .eq("verification_type", "vehicle")
      .eq("status", "verified")
      .maybeSingle();

    return NextResponse.json({ vehicle: { ...data, verified: Boolean(verificationRecord) } });
  } catch {
    return NextResponse.json({ error: "Unable to load vehicle." }, { status: 500 });
  }
}

// Lets the vehicle's owner/business manager attach uploaded photo paths
// (and, incidentally, amenities) after the draft already exists — photo
// upload needs a real vehicle_id to satisfy the storage bucket's RLS
// (can_manage_vehicle checks an existing row), so this is a step-two
// call after POST /api/vehicles, not part of the same request.
export async function PATCH(request: Request, { params }: { params: Promise<{ vehicleId: string }> }) {
  try {
    const { vehicleId } = await params;
    const body = await request.json() as { photoPaths?: string[]; amenities?: string[] };
    const { supabase } = await requireUser();

    const update: Record<string, string[]> = {};
    if (body.photoPaths) update.photo_paths = body.photoPaths;
    if (body.amenities) update.amenities = body.amenities;
    if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

    const { data, error } = await supabase.from("vehicles").update(update).eq("id", vehicleId).select().maybeSingle();
    if (error) return NextResponse.json({ error: "Unable to update this vehicle." }, { status: 500 });
    if (!data) return NextResponse.json({ error: "You are not authorized to manage this vehicle." }, { status: 403 });

    return NextResponse.json({ vehicle: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to update this vehicle." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}
