import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const allowedStatuses = ["active", "suspended", "deleted"] as const;

// GoTrue's admin API takes a ban_duration string rather than a boolean —
// there's no literal "forever", so this is the documented convention for
// an effectively permanent ban (~100 years). "none" lifts it.
const PERMANENT_BAN = "876000h";

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

    // "Deleted" now actually bans the account from signing back in — a
    // real hard delete isn't possible for any account with booking/
    // vehicle/capability history (every FK to profiles is ON DELETE
    // RESTRICT, and even a brand-new signup already has
    // user_capabilities rows), so this is the closest real equivalent:
    // the identity is locked out and can't be reused to log back in.
    // Reactivating lifts the ban again.
    const adminClient = createSupabaseAdminClient();
    if (adminClient && (body.status === "deleted" || body.status === "active")) {
      const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
        ban_duration: body.status === "deleted" ? PERMANENT_BAN : "none",
      });
      if (authError) console.error("admin/users ban/unban error:", authError);
    }

    return NextResponse.json({ profile: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "CAPABILITY_REQUIRED" ? 403 : 500;
    if (status === 500) console.error("admin/users PATCH error:", error);
    return NextResponse.json({ error: status === 403 ? "Admin access required." : "Unable to update this user." }, { status });
  }
}
