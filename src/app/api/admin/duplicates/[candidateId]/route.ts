import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/authorization";

const allowedStatuses = ["flagged", "under_review", "verified", "rejected", "merged"] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ candidateId: string }> }) {
  try {
    const { candidateId } = await params;
    const body = await request.json() as { status?: string; note?: string };
    if (!body.status || !allowedStatuses.includes(body.status as (typeof allowedStatuses)[number])) {
      return NextResponse.json({ error: "Unsupported status." }, { status: 400 });
    }

    const { supabase } = await requireCapability("can_manage_platform");
    const { data, error } = await supabase.rpc("admin_update_merge_candidate", {
      candidate_id: candidateId,
      new_status: body.status,
      note: body.note ?? null,
    });

    if (error) {
      const reason = error.message ?? "";
      if (reason.includes("CANDIDATE_NOT_FOUND")) return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
      return NextResponse.json({ error: "Unable to update this candidate." }, { status: 500 });
    }

    return NextResponse.json({ candidate: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "CAPABILITY_REQUIRED" ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? "Admin access required." : "Unable to update this candidate." }, { status });
  }
}
