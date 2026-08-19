import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";

export async function PATCH(_request: Request, { params }: { params: Promise<{ notificationId: string }> }) {
  try {
    const { notificationId } = await params;
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("mark_notification_read", { notification_id: notificationId });
    if (error) return NextResponse.json({ error: "Unable to update notification." }, { status: 500 });
    return NextResponse.json({ notification: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to update notification." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}
