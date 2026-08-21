import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/authorization";

const allowedStatuses = ["active", "suspended", "deleted"] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await params;
    const body = await request.json() as { status?: string; reason?: string };
    if (!body.status || !allowedStatuses.includes(body.status as (typeof allowedStatuses)[number])) {
      return NextResponse.json({ error: "status must be one of: " + allowedStatuses.join(", ") }, { status: 400 });
    }

    const { supabase } = await requireCapability("can_manage_platform");
    const { data, error } = await supabase.rpc("admin_set_user_status", { target_user_id: userId, new_status: body.status, reason: body.reason ?? null });

    if (error) {
      const reason = error.message ?? "";
      if (reason.includes("CANNOT_MODIFY_OWN_STATUS")) return NextResponse.json({ error: "You can't change your own account status." }, { status: 409 });
      if (reason.includes("USER_NOT_FOUND")) return NextResponse.json({ error: "User not found." }, { status: 404 });
      return NextResponse.json({ error: "Unable to update this user." }, { status: 500 });
    }

    return NextResponse.json({ profile: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "CAPABILITY_REQUIRED" ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? "Admin access required." : "Unable to update this user." }, { status });
  }
}
