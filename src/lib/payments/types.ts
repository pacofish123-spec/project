export type PaymentProviderId = "stripe" | "paypal" | "azul" | "cardnet";

export interface CheckoutSessionInput {
  paymentRecordId: string;
  bookingId: string;
  amount: number;
  currency: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResult {
  /** Where to send the renter's browser to complete payment. */
  redirectUrl: string;
  /** The provider's own id for this attempt (Stripe session id, PayPal order id, ...). */
  providerReference: string;
}

// A processor is "configured" once its required env vars are present.
// The UI only ever offers providers this returns true for — never a
// button that would fail the moment someone clicked it.
export interface PaymentProvider {
  id: PaymentProviderId;
  label: string;
  isConfigured(): boolean;
  createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult>;
}
