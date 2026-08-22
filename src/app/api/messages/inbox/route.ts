import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";

// One row per booking-thread the caller is a party to, other-party
// identity already resolved, latest message + unread count included —
// see get_message_inbox() in migration 0038. Powers the floating
// messaging widget's conversation list.
export async function GET() {
  try {
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("get_message_inbox");
    if (error) return NextResponse.json({ error: "Unable to load your messages." }, { status: 500 });
    return NextResponse.json({ conversations: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to load your messages." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}
