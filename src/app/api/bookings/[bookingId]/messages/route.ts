import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";

export async function GET(_request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    const { bookingId } = await params;
    const { supabase } = await requireUser();
    // mark_messages_read doesn't affect what's returned here, so it
    // doesn't need to block the select — run them together rather than
    // one after the other. (Still awaited, not fire-and-forget: an
    // unawaited promise isn't guaranteed to finish once the response is
    // sent in a serverless runtime.)
    const [{ data, error }] = await Promise.all([
      supabase.from("messages").select("*").eq("booking_id", bookingId).order("created_at", { ascending: true }),
      supabase.rpc("mark_messages_read", { target_booking_id: bookingId }),
    ]);
    if (error) return NextResponse.json({ error: "Unable to load messages." }, { status: 500 });
    return NextResponse.json({ messages: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to load messages." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    const { bookingId } = await params;
    const body = await request.json() as { body?: string };
    if (!body.body || !body.body.trim()) return NextResponse.json({ error: "Message cannot be empty." }, { status: 400 });

    const { supabase, user } = await requireUser();
    const { data, error } = await supabase.from("messages").insert({
      booking_id: bookingId,
      sender_user_id: user.id,
      body: body.body.trim(),
    }).select().single();

    if (error) return NextResponse.json({ error: "Unable to send this message." }, { status: 400 });
    return NextResponse.json({ message: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to send this message." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}
