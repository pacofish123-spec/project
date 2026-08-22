import type { CheckoutSessionInput, CheckoutSessionResult, PaymentProvider } from "./types";

// No SDK — PayPal's REST API is small enough that a dependency isn't
// worth it, and it keeps the exact request/response shape visible
// here instead of behind a wrapper.
function baseUrl(): string {
  return process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

function isPaypalConfigured(): boolean {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

// PayPal's supported transaction currencies:
// https://developer.paypal.com/docs/integration/direct/rest/currency-codes/
// Notably absent: DOP — this marketplace's default currency. A DOP
// order create otherwise fails with 422 CURRENCY_NOT_SUPPORTED, which
// the pay route was surfacing as a generic "Unable to start payment."
const PAYPAL_SUPPORTED_CURRENCIES = new Set([
  "AUD", "BRL", "CAD", "CNY", "CZK", "DKK", "EUR", "HKD", "HUF", "ILS",
  "JPY", "MYR", "MXN", "TWD", "NZD", "NOK", "PHP", "PLN", "GBP", "SGD",
  "SEK", "CHF", "THB", "USD",
]);

function supportsCurrency(currency: string): boolean {
  return PAYPAL_SUPPORTED_CURRENCIES.has(currency.toUpperCase());
}

async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("PAYPAL_NOT_CONFIGURED");

  const response = await fetch(`${baseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) throw new Error(`PAYPAL_AUTH_FAILED: ${response.status}`);
  const data = await response.json() as { access_token: string };
  return data.access_token;
}

async function createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
  const token = await getAccessToken();
  const response = await fetch(`${baseUrl()}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: input.paymentRecordId,
        custom_id: input.paymentRecordId,
        description: input.description,
        amount: { currency_code: input.currency.toUpperCase(), value: input.amount.toFixed(2) },
      }],
      application_context: {
        return_url: input.successUrl,
        cancel_url: input.cancelUrl,
        user_action: "PAY_NOW",
        brand_name: "yoRento",
      },
    }),
  });
  if (!response.ok) throw new Error(`PAYPAL_ORDER_CREATE_FAILED: ${response.status}`);
  const order = await response.json() as { id: string; links: Array<{ rel: string; href: string }> };
  const approveLink = order.links.find((link) => link.rel === "approve")?.href;
  if (!approveLink) throw new Error("PAYPAL_ORDER_MISSING_APPROVE_LINK");
  return { redirectUrl: approveLink, providerReference: order.id };
}

export const paypalProvider: PaymentProvider = {
  id: "paypal",
  label: "PayPal",
  isConfigured: isPaypalConfigured,
  createCheckoutSession,
  supportsCurrency,
};

// Called from the return route once the buyer approves on PayPal's
// side — PayPal Checkout requires an explicit capture call, it doesn't
// push a webhook the instant approval happens the way Stripe Checkout
// does.
export async function capturePaypalOrder(orderId: string): Promise<{ status: string; captureId: string | null }> {
  const token = await getAccessToken();
  const response = await fetch(`${baseUrl()}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const data = await response.json() as {
    status: string;
    purchase_units?: Array<{ payments?: { captures?: Array<{ id: string }> } }>;
  };
  if (!response.ok) throw new Error(`PAYPAL_CAPTURE_FAILED: ${response.status}`);
  const captureId = data.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? null;
  return { status: data.status, captureId };
}

export async function refundPaypalCapture(captureId: string): Promise<string> {
  const token = await getAccessToken();
  const response = await fetch(`${baseUrl()}/v2/payments/captures/${captureId}/refund`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error(`PAYPAL_REFUND_FAILED: ${response.status}`);
  const data = await response.json() as { id: string };
  return data.id;
}

// Payouts API — a host just needs a PayPal email on file, no OAuth
// "connect" flow required for this product.
export async function createPaypalPayout(receiverEmail: string, amount: number, currency: string, note: string): Promise<string> {
  const token = await getAccessToken();
  const response = await fetch(`${baseUrl()}/v1/payments/payouts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender_batch_header: { sender_batch_id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, email_subject: "You have a payout from yoRento" },
      items: [{
        recipient_type: "EMAIL",
        amount: { value: amount.toFixed(2), currency: currency.toUpperCase() },
        receiver: receiverEmail,
        note,
      }],
    }),
  });
  if (!response.ok) throw new Error(`PAYPAL_PAYOUT_FAILED: ${response.status}`);
  const data = await response.json() as { batch_header: { payout_batch_id: string } };
  return data.batch_header.payout_batch_id;
}

// Verifies a webhook actually came from PayPal (not spoofed) — PayPal
// doesn't sign with a shared secret like Stripe; instead you hand the
// full envelope + headers back to their own verification endpoint.
export async function verifyPaypalWebhookSignature(headers: Headers, rawBody: string): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;
  const token = await getAccessToken();
  const response = await fetch(`${baseUrl()}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: JSON.parse(rawBody),
    }),
  });
  if (!response.ok) return false;
  const data = await response.json() as { verification_status: string };
  return data.verification_status === "SUCCESS";
}
