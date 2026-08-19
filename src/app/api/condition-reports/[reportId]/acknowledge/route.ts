import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";

export async function POST(_request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    const { reportId } = await params;
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("acknowledge_condition_report", { report_id: reportId });

    if (error) {
      const reason = error.message ?? "";
      if (reason.includes("CANNOT_ACKNOWLEDGE_OWN_REPORT")) return NextResponse.json({ error: "You can't acknowledge your own report — the other party needs to." }, { status: 409 });
      if (reason.includes("BOOKING_ACCESS_DENIED")) return NextResponse.json({ error: "You are not authorized to manage this booking." }, { status: 403 });
      if (reason.includes("REPORT_NOT_FOUND")) return NextResponse.json({ error: "Report not found." }, { status: 404 });
      return NextResponse.json({ error: "Unable to acknowledge this report." }, { status: 500 });
    }

    return NextResponse.json({ report: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to acknowledge this report." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}
