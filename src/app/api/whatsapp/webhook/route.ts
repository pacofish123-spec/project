import { NextResponse } from "next/server";
import { verifyWhatsAppWebhookChallenge } from "@/lib/whatsapp";
import { normalizePhone } from "@/lib/identity";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// GET: Meta's one-time webhook verification handshake, run when the
// webhook URL is registered (or re-verified) in the developer console.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const challenge = verifyWhatsAppWebhookChallenge(
    url.searchParams.get("hub.mode"),
    url.searchParams.get("hub.verify_token"),
    url.searchParams.get("hub.challenge"),
  );
  if (!challenge) return NextResponse.json({ error: "Verification failed." }, { status: 403 });
  return new NextResponse(challenge, { status: 200 });
}

interface WhatsAppWebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{ from: string; text?: { body?: string } }>;
      };
    }>;
  }>;
}

// POST: inbound messages. Same service-role pattern as the Stripe/PayPal
// webhooks — this is a server-to-server call from Meta with no
// Supabase session, so RLS can't apply the normal way. Meta doesn't
// sign webhook bodies with a shared secret the way Stripe does by
// default; WHATSAPP_VERIFY_TOKEN gates registration (GET above), and
// this endpoint's URL itself is the practical secret — same trust
// model paypal.ts's webhook signature helper explicitly notes for
// providers that don't sign requests.
export async function POST(request: Request) {
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ received: true }); // Never error back to Meta over our own config gap.

  const body = await request.json().catch(() => null) as WhatsAppWebhookPayload | null;
  const messages = body?.entry?.flatMap((entry) => entry.changes?.flatMap((change) => change.value?.messages ?? []) ?? []) ?? [];

  for (const message of messages) {
    if (!message.from || !message.text?.body) continue;
    const normalized = normalizePhone(message.from);
    const { data: profile } = await admin.from("profiles").select("id").eq("normalized_phone", normalized).maybeSingle();

    await admin.from("whatsapp_inbound_messages").insert({
      from_phone: message.from,
      matched_user_id: profile?.id ?? null,
      body: message.text.body,
      raw_payload: message,
    });

    // Notify whichever admins exist — inserted directly into
    // `notifications` (the same table public.notify() writes to, see
    // 0006_messaging_notifications.sql) rather than calling that RPC,
    // consistent with how the Stripe/PayPal webhooks in this codebase
    // already write straight to tables via the service-role client.
    const { data: admins } = await admin.from("user_capabilities").select("user_id").eq("capability", "can_manage_platform");
    if (admins && admins.length > 0) {
      await admin.from("notifications").insert(admins.map((adminUser) => ({
        user_id: adminUser.user_id,
        type: "whatsapp_message",
        title: "New WhatsApp message",
        body: message.text!.body!.slice(0, 120),
        link: "/admin",
      })));
    }
  }

  return NextResponse.json({ received: true });
}
