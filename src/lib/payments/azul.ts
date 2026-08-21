import type { PaymentProvider } from "./types";

// Azul (Banco Popular Dominicano) is the most commonly integrated card
// processor for DR e-commerce merchants, but getting it live needs a
// real merchant account and their Webservice credentials/certificate —
// not a free self-serve sandbox like Stripe or PayPal. This is the
// plug point: once AZUL_MERCHANT_ID / AZUL_AUTH_KEY / AZUL_CERT are
// set, isConfigured() flips true and the UI offers it automatically.
// createCheckoutSession is intentionally unimplemented until then,
// rather than a guessed-at integration against undocumented behavior.
function isAzulConfigured(): boolean {
  return Boolean(process.env.AZUL_MERCHANT_ID && process.env.AZUL_AUTH_KEY);
}

export const azulProvider: PaymentProvider = {
  id: "azul",
  label: "Azul",
  isConfigured: isAzulConfigured,
  async createCheckoutSession() {
    throw new Error("AZUL_NOT_YET_IMPLEMENTED");
  },
};
