import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/authorization";

export async function PATCH(request: Request, { params }: { params: Promise<{ vehicleId: string }> }) {
  try {
    const { vehicleId } = await params;
    const body = await request.json() as { promoted?: boolean };
    if (typeof body.promoted !== "boolean") return NextResponse.json({ error: "promoted must be true or false." }, { status: 400 });

    const { supabase } = await requireCapability("can_manage_platform");
    const { data, error } = await supabase.rpc("admin_set_vehicle_promotion", { target_vehicle_id: vehicleId, is_promoted: body.promoted });

    if (error) {
      const reason = error.message ?? "";
      if (reason.includes("VEHICLE_NOT_FOUND")) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
      return NextResponse.json({ error: "Unable to update promotion." }, { status: 500 });
    }

    return NextResponse.json({ vehicle: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "CAPABILITY_REQUIRED" ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? "Admin access required." : "Unable to update promotion." }, { status });
  }
}
