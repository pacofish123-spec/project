import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/authorization";

export async function GET() {
  try {
    const { supabase } = await requireCapability("can_manage_platform");
    const { data: users, error: usersError } = await supabase.rpc("admin_list_users");
    if (usersError) {
      console.error("admin_list_users RPC error:", usersError);
      return NextResponse.json({ error: "Unable to load the directory." }, { status: 500 });
    }
    return NextResponse.json({ users: users ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "CAPABILITY_REQUIRED" ? 403 : 500;
    if (status === 500) console.error("admin/users GET error:", error);
    return NextResponse.json({ error: status === 403 ? "Admin access required." : "Unable to load the directory." }, { status });
  }
}
