import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";

export async function POST(_request: Request, { params }: { params: Promise<{ vehicleId: string }> }) {
  try {
    const { vehicleId } = await params;
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("request_vehicle_verification", { target_vehicle_id: vehicleId });

    if (error) {
      const reason = error.message ?? "";
      if (reason.includes("VEHICLE_ACCESS_DENIED")) return NextResponse.json({ error: "You are not authorized to manage this vehicle." }, { status: 403 });
      if (reason.includes("VERIFICATION_ALREADY_REQUESTED")) return NextResponse.json({ error: "Verification has already been requested for this vehicle." }, { status: 409 });
      return NextResponse.json({ error: "Unable to request verification." }, { status: 500 });
    }

    return NextResponse.json({ verification: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to request verification." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}
