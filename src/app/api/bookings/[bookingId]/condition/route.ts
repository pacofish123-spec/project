import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";
import { CONDITION_REPORT_SHOT_KEYS, type ConditionReportShot } from "@/lib/condition-report-shots";

export async function GET(_request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    const { bookingId } = await params;
    const { supabase } = await requireUser();
    const { data, error } = await supabase.from("condition_reports").select("*").eq("booking_id", bookingId).order("stage");
    if (error) return NextResponse.json({ error: "Unable to load condition reports." }, { status: 500 });
    return NextResponse.json({ reports: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to load condition reports." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    const { bookingId } = await params;
    const body = await request.json() as { stage?: string; fuelLevel?: number; mileage?: number; notes?: string; photoPaths?: string[]; shots?: Record<string, ConditionReportShot>; finalize?: boolean };
    if (!body.stage || !["pickup", "return"].includes(body.stage)) return NextResponse.json({ error: "Stage must be pickup or return." }, { status: 400 });

    // A save is always allowed incrementally (one shot at a time) —
    // only *finalizing* (what the UI calls once all 8 slots are
    // filled and the renter/host hits Save) requires every shot to be
    // present. This is the "hard-require completeness" half of the
    // guided capture; auto-diffing pickup vs. return is a separate,
    // later pass.
    if (body.finalize) {
      const missing = CONDITION_REPORT_SHOT_KEYS.filter((key) => !body.shots?.[key]?.path);
      if (missing.length > 0) {
        return NextResponse.json({ error: `All 8 shots are required before saving: missing ${missing.join(", ")}.` }, { status: 400 });
      }
    }

    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("submit_condition_report", {
      target_booking_id: bookingId,
      report_stage: body.stage,
      report_fuel_level: body.fuelLevel ?? null,
      report_mileage: body.mileage ?? null,
      report_notes: body.notes ?? null,
      report_photo_paths: body.photoPaths ?? null,
      report_shots: body.shots ?? null,
    });

    if (error) {
      const reason = error.message ?? "";
      if (reason.includes("BOOKING_ACCESS_DENIED")) return NextResponse.json({ error: "You are not authorized to manage this booking." }, { status: 403 });
      if (reason.includes("REPORT_ALREADY_ACKNOWLEDGED")) return NextResponse.json({ error: "This report has already been acknowledged by both sides and can't be changed." }, { status: 409 });
      if (reason.includes("BOOKING_NOT_FOUND")) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
      return NextResponse.json({ error: "Unable to save this report." }, { status: 500 });
    }

    return NextResponse.json({ report: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to save this report." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}
