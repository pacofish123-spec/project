import { stripeProvider } from "./stripe";
import { paypalProvider } from "./paypal";
import { azulProvider } from "./azul";
import { cardnetProvider } from "./cardnet";
import type { PaymentProvider, PaymentProviderId } from "./types";

export type { PaymentProviderId, PaymentProvider, CheckoutSessionInput, CheckoutSessionResult } from "./types";

const registry: Record<PaymentProviderId, PaymentProvider> = {
  stripe: stripeProvider,
  paypal: paypalProvider,
  azul: azulProvider,
  cardnet: cardnetProvider,
};

export function getPaymentProvider(id: string): PaymentProvider | null {
  return id in registry ? registry[id as PaymentProviderId] : null;
}

// Only providers with real credentials configured — this is what
// drives which "Pay with ..." buttons a renter ever sees.
export function getEnabledProviders(): PaymentProvider[] {
  return Object.values(registry).filter((provider) => provider.isConfigured());
}
