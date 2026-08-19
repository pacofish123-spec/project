import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/authorization";

const allowedStatuses = ["verified", "failed", "requires_information", "in_review"] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ recordId: string }> }) {
  try {
    const { recordId } = await params;
    const body = await request.json() as { status?: string; note?: string };
    if (!body.status || !allowedStatuses.includes(body.status as (typeof allowedStatuses)[number])) {
      return NextResponse.json({ error: "Unsupported status." }, { status: 400 });
    }

    const { supabase } = await requireCapability("can_manage_platform");
    const { data, error } = await supabase.rpc("admin_review_verification", {
      record_id: recordId,
      new_status: body.status,
      note: body.note ?? null,
    });

    if (error) {
      const reason = error.message ?? "";
      if (reason.includes("RECORD_NOT_FOUND")) return NextResponse.json({ error: "Verification record not found." }, { status: 404 });
      return NextResponse.json({ error: "Unable to update verification record." }, { status: 500 });
    }

    return NextResponse.json({ record: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "CAPABILITY_REQUIRED" ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? "Admin access required." : "Unable to update verification record." }, { status });
  }
}
