import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/authorization";

const allowedStatuses = ["draft", "pending_review", "published", "paused", "archived"] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ vehicleId: string }> }) {
  try {
    const { vehicleId } = await params;
    const body = await request.json() as { status?: string };
    if (!body.status || !allowedStatuses.includes(body.status as (typeof allowedStatuses)[number])) {
      return NextResponse.json({ error: "status must be one of: " + allowedStatuses.join(", ") }, { status: 400 });
    }

    const { supabase } = await requireCapability("can_manage_platform");
    const { data, error } = await supabase.rpc("admin_set_vehicle_status", { target_vehicle_id: vehicleId, new_status: body.status });

    if (error) {
      const reason = error.message ?? "";
      if (reason.includes("VEHICLE_NOT_FOUND")) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
      return NextResponse.json({ error: "Unable to update vehicle status." }, { status: 500 });
    }

    return NextResponse.json({ vehicle: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "CAPABILITY_REQUIRED" ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? "Admin access required." : "Unable to update vehicle status." }, { status });
  }
}
