import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";

export async function POST() {
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("mark_all_notifications_read");
    if (error) return NextResponse.json({ error: "Unable to update notifications." }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to update notifications." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}
