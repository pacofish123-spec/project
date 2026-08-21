import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function deviceTypeFrom(userAgent: string): "desktop" | "mobile" | "tablet" {
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet(?!.*mobile)/.test(ua)) return "tablet";
  if (/mobi|iphone|android/.test(ua)) return "mobile";
  return "desktop";
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { path?: string; sessionId?: string; referrer?: string | null };
    if (!body.path || typeof body.path !== "string" || !body.sessionId || typeof body.sessionId !== "string") {
      return NextResponse.json({ error: "path and sessionId are required." }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const userAgent = request.headers.get("user-agent") ?? "";
    const { error } = await supabase.from("page_views").insert({
      path: body.path.slice(0, 500),
      referrer: body.referrer ? body.referrer.slice(0, 500) : null,
      session_id: body.sessionId.slice(0, 100),
      device_type: deviceTypeFrom(userAgent),
    });

    // Never surface a failure here — analytics logging shouldn't be
    // able to break or even be noticeable to the page that triggered it.
    if (error) return NextResponse.json({ ok: false });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
