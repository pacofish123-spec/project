import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";

interface SubscriptionInput {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as SubscriptionInput;
    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return NextResponse.json({ error: "Invalid push subscription." }, { status: 400 });
    }

    const { supabase, user } = await requireUser();
    const { error } = await supabase.from("push_subscriptions").upsert({
      user_id: user.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth_key: body.keys.auth,
    }, { onConflict: "endpoint" });

    if (error) return NextResponse.json({ error: "Unable to save subscription." }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to save subscription." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}

// Called when a device explicitly unsubscribes (e.g. the browser
// invalidated the subscription) so it stops being pushed to.
export async function DELETE(request: Request) {
  try {
    const body = await request.json() as { endpoint?: string };
    if (!body.endpoint) return NextResponse.json({ error: "Missing endpoint." }, { status: 400 });

    const { supabase } = await requireUser();
    await supabase.from("push_subscriptions").delete().eq("endpoint", body.endpoint);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to remove subscription." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}
