import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";

export async function POST(_request: Request, { params }: { params: Promise<{ vehicleId: string }> }) {
  try {
    const { vehicleId } = await params;
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("publish_vehicle", { target_vehicle_id: vehicleId });

    if (error) {
      const reason = error.message ?? "";
      if (reason.includes("VEHICLE_ACCESS_DENIED")) return NextResponse.json({ error: "You are not authorized to manage this vehicle." }, { status: 403 });
      if (reason.includes("VEHICLE_NOT_VERIFIED")) return NextResponse.json({ error: "This vehicle needs a verified check before it can be published." }, { status: 409 });
      if (reason.includes("VEHICLE_NOT_ELIGIBLE")) return NextResponse.json({ error: "This vehicle can't be published from its current status." }, { status: 409 });
      return NextResponse.json({ error: "Unable to publish this vehicle." }, { status: 500 });
    }

    return NextResponse.json({ vehicle: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to publish this vehicle." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}
