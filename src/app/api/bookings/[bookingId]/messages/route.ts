import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push/send";

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

    // Push to whichever side of the conversation didn't just send this
    // — best-effort (a failure here shouldn't fail the send itself),
    // but still awaited: an unawaited promise isn't guaranteed to
    // finish once the response is sent in a serverless runtime. Needs
    // the admin client — push_subscriptions' RLS only lets a user read
    // their own rows, and this is reading the OTHER party's.
    try {
      await notifyOtherParty(bookingId, user.id, body.body.trim());
    } catch {
      // best-effort, see above
    }

    return NextResponse.json({ message: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to send this message." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}

// owner_user_id is always set even for business-owned vehicles (it's
// the account that created the listing), so this stays a single
// recipient lookup rather than needing to fan out to every business
// member — same simplification get_message_inbox() makes for "who's
// the other party" (migration 0038).
async function notifyOtherParty(bookingId: string, senderId: string, messageBody: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;

  const { data: booking } = await admin.from("bookings").select("renter_user_id, vehicle_id").eq("id", bookingId).maybeSingle();
  if (!booking) return;
  const { data: vehicle } = await admin.from("vehicles").select("owner_user_id, make, model").eq("id", booking.vehicle_id).maybeSingle();
  if (!vehicle) return;

  const recipientId = senderId === booking.renter_user_id ? vehicle.owner_user_id : booking.renter_user_id;
  if (!recipientId || recipientId === senderId) return;

  const { data: senderProfile } = await admin.from("public_profiles").select("display_name").eq("id", senderId).maybeSingle();
  const senderName = senderProfile?.display_name || "New message";

  await sendPushToUser(admin, recipientId, {
    title: senderName,
    body: messageBody.length > 120 ? `${messageBody.slice(0, 117)}...` : messageBody,
    url: `/messages/${bookingId}`,
  });
}
