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

export async function DELETE(_request: Request, { params }: { params: Promise<{ vehicleId: string }> }) {
  try {
    const { vehicleId } = await params;
    const { supabase } = await requireCapability("can_manage_platform");

    // Same ordering reason as the host-facing delete endpoint: the
    // storage delete policy's admin check works independent of the row
    // existing, but clean up first anyway to keep both code paths
    // consistent and easy to reason about.
    const { data: existing } = await supabase.from("vehicles").select("photo_paths").eq("id", vehicleId).maybeSingle();
    if (existing?.photo_paths?.length) {
      await supabase.storage.from("vehicle-photos").remove(existing.photo_paths);
    }

    const { data, error } = await supabase.rpc("admin_delete_vehicle", { target_vehicle_id: vehicleId });

    if (error) {
      const reason = error.message ?? "";
      if (reason.includes("VEHICLE_NOT_FOUND")) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
      if (error.code === "23503") return NextResponse.json({ error: "This vehicle has booking or verification history and can't be deleted." }, { status: 409 });
      return NextResponse.json({ error: "Unable to delete this vehicle." }, { status: 500 });
    }

    return NextResponse.json({ vehicle: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "CAPABILITY_REQUIRED" ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? "Admin access required." : "Unable to delete this vehicle." }, { status });
  }
}
