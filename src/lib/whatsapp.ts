// Meta WhatsApp Business Cloud API — no SDK, same hand-rolled-fetch
// style as paypal.ts. Requires a real WhatsApp Business number/account
// (the user already has one) and its own app in Meta's developer
// console; env-var-gated the same way every other provider in this
// codebase is (azul.ts, stripe.ts) so importing this module never
// throws in an environment that hasn't configured it yet.
const GRAPH_API_VERSION = "v21.0";

export function isWhatsAppConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

// WhatsApp requires the recipient in E.164 without a leading "+" —
// this strips whatever punctuation a phone field might carry.
function toWhatsAppPhone(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

export async function sendWhatsAppMessage(toPhone: string, body: string): Promise<void> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) throw new Error("WHATSAPP_NOT_CONFIGURED");

  const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toWhatsAppPhone(toPhone),
      type: "text",
      text: { body },
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`WHATSAPP_SEND_FAILED: ${response.status} ${detail}`);
  }
}

// Meta's webhook verification handshake (GET, called once when the
// webhook URL is registered in the developer console, and again any
// time the subscription is re-verified).
export function verifyWhatsAppWebhookChallenge(mode: string | null, token: string | null, challenge: string | null): string | null {
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!expected || mode !== "subscribe" || token !== expected || !challenge) return null;
  return challenge;
}
