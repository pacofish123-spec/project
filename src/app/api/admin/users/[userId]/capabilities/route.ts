import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/authorization";
import type { Capability } from "@/lib/domain";

function errorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "REQUEST_FAILED";
  if (message === "AUTHENTICATION_REQUIRED") return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if (message === "CAPABILITY_REQUIRED") return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const reason = (error as { message?: string })?.message ?? "";
  if (reason.includes("CANNOT_REMOVE_LAST_ADMIN")) return NextResponse.json({ error: "You can't remove the last remaining admin." }, { status: 409 });
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await params;
    const body = await request.json() as { capability?: Capability };
    if (!body.capability) return NextResponse.json({ error: "capability is required." }, { status: 400 });

    const { supabase } = await requireCapability("can_manage_platform");
    const { error } = await supabase.rpc("admin_grant_capability", { target_user_id: userId, capability_name: body.capability });
    if (error) return errorResponse(error, "Unable to grant capability.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Unable to grant capability.");
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await params;
    const body = await request.json() as { capability?: Capability };
    if (!body.capability) return NextResponse.json({ error: "capability is required." }, { status: 400 });

    const { supabase } = await requireCapability("can_manage_platform");
    const { error } = await supabase.rpc("admin_revoke_capability", { target_user_id: userId, capability_name: body.capability });
    if (error) return errorResponse(error, "Unable to revoke capability.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Unable to revoke capability.");
  }
}
