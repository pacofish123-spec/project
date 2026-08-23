import Stripe from "stripe";
import type { CheckoutSessionInput, CheckoutSessionResult, PaymentProvider } from "./types";

const STRIPE_API_VERSION = "2026-07-29.dahlia";

let cachedClient: Stripe | null = null;

// Lazily constructed so importing this module never throws in an
// environment that hasn't configured Stripe yet — only actually
// calling one of these functions does, and only if it's reached
// without isConfigured() having been checked first.
export function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_NOT_CONFIGURED");
  if (!cachedClient) cachedClient = new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });
  return cachedClient;
}

function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

// Stripe wants the smallest currency unit (cents), except for a
// handful of zero-decimal currencies (JPY, KRW, ...) — DOP/USD both
// use two decimals, but this stays correct if that ever changes.
// Shared by every function below that builds a Stripe amount.
const ZERO_DECIMAL_CURRENCIES = new Set(["BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"]);
function toStripeUnitAmount(amount: number, currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? Math.round(amount) : Math.round(amount * 100);
}

async function createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
  const stripe = getStripeClient();
  const currency = input.currency.toLowerCase();
  const unitAmount = toStripeUnitAmount(input.amount, input.currency);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    client_reference_id: input.paymentRecordId,
    metadata: { paymentRecordId: input.paymentRecordId, bookingId: input.bookingId },
    line_items: [{
      quantity: 1,
      price_data: {
        currency,
        unit_amount: unitAmount,
        product_data: { name: input.description },
      },
    }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  });

  if (!session.url) throw new Error("STRIPE_SESSION_MISSING_URL");
  return { redirectUrl: session.url, providerReference: session.id };
}

export const stripeProvider: PaymentProvider = {
  id: "stripe",
  label: "Card (Stripe)",
  isConfigured: isStripeConfigured,
  createCheckoutSession,
};

export function constructStripeWebhookEvent(rawBody: string, signature: string): Stripe.Event {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_NOT_CONFIGURED");
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}

// --- Host payouts: Stripe Connect (Express accounts) ------------------
// "Separate charges and transfers": the renter's card charge lands in
// the platform's own Stripe balance (createCheckoutSession above never
// touches a connected account), and once a booking completes an admin
// triggers a Transfer of (total - platform_fee) out to the host's
// connected account. That keeps the charge side simple and puts a
// human in the loop before money leaves the platform.

export async function createStripeConnectAccount(email: string | undefined, countryCode: string): Promise<string> {
  const stripe = getStripeClient();
  const account = await stripe.accounts.create({
    type: "express",
    country: countryCode || "US",
    email,
    capabilities: { transfers: { requested: true }, card_payments: { requested: true } },
  });
  return account.id;
}

export async function createStripeConnectOnboardingLink(accountId: string, refreshUrl: string, returnUrl: string): Promise<string> {
  const stripe = getStripeClient();
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });
  return link.url;
}

export async function getStripeConnectAccountStatus(accountId: string): Promise<"onboarding" | "active" | "restricted"> {
  const stripe = getStripeClient();
  const account = await stripe.accounts.retrieve(accountId);
  if (account.payouts_enabled && account.charges_enabled) return "active";
  if (account.requirements?.disabled_reason) return "restricted";
  return "onboarding";
}

export async function createStripeTransfer(accountId: string, amount: number, currency: string): Promise<string> {
  const stripe = getStripeClient();
  const unitAmount = toStripeUnitAmount(amount, currency);
  const transfer = await stripe.transfers.create({
    amount: unitAmount,
    currency: currency.toLowerCase(),
    destination: accountId,
  });
  return transfer.id;
}

export async function createStripeRefund(paymentIntentId: string): Promise<string> {
  const stripe = getStripeClient();
  const refund = await stripe.refunds.create({ payment_intent: paymentIntentId });
  return refund.id;
}

// --- Refundable deposit: an authorization hold, not a charge ----------
// Same Checkout Session shape as createCheckoutSession above, except
// capture_method: "manual" — the card is authorized (funds reserved)
// but never actually taken. Release it (releaseDepositHold) once the
// host confirms a clean return, or capture it (captureDepositHold) if
// they don't. Most card networks auto-expire an uncaptured
// authorization around 7 days — see platform-policy.ts.

export async function createDepositHoldSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
  const stripe = getStripeClient();
  const currency = input.currency.toLowerCase();
  const unitAmount = toStripeUnitAmount(input.amount, input.currency);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_intent_data: { capture_method: "manual" },
    client_reference_id: input.paymentRecordId,
    metadata: { paymentRecordId: input.paymentRecordId, bookingId: input.bookingId, kind: "deposit_hold" },
    line_items: [{
      quantity: 1,
      price_data: { currency, unit_amount: unitAmount, product_data: { name: input.description } },
    }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  });

  if (!session.url) throw new Error("STRIPE_SESSION_MISSING_URL");
  return { redirectUrl: session.url, providerReference: session.id };
}

// Releases the hold entirely — the renter's card is never charged.
// Called once a host acknowledges a clean return-stage condition
// report (see condition-reports/[reportId]/acknowledge/route.ts).
export async function releaseDepositHold(paymentIntentId: string): Promise<void> {
  const stripe = getStripeClient();
  await stripe.paymentIntents.cancel(paymentIntentId);
}

// Captures some or all of the held amount — a damage claim. Deliberately
// never called automatically anywhere in this codebase: only reachable
// from the admin disputes flow, after a human reviews the claim.
export async function captureDepositHold(paymentIntentId: string, amount?: number, currency?: string): Promise<void> {
  const stripe = getStripeClient();
  const params = amount !== undefined && currency ? { amount_to_capture: toStripeUnitAmount(amount, currency) } : undefined;
  await stripe.paymentIntents.capture(paymentIntentId, params);
}

// --- Identity: automated document + selfie verification ---------------

export async function createStripeIdentitySession(returnUrl: string): Promise<{ id: string; url: string }> {
  const stripe = getStripeClient();
  const session = await stripe.identity.verificationSessions.create({
    type: "document",
    options: { document: { require_matching_selfie: true } },
    return_url: returnUrl,
  });
  if (!session.url) throw new Error("STRIPE_IDENTITY_SESSION_MISSING_URL");
  return { id: session.id, url: session.url };
}

export function isStripeIdentityConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
