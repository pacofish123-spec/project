import type { PaymentProvider } from "./types";

// CardNet is primarily the card-processing switch/network behind
// several DR banks — merchant access usually comes through your
// acquiring bank rather than a self-serve API signup. Same plug-point
// pattern as azul.ts: wire up CARDNET_MERCHANT_ID / CARDNET_API_KEY
// once you have them, and isConfigured() + the UI pick it up with no
// other changes needed.
function isCardnetConfigured(): boolean {
  return Boolean(process.env.CARDNET_MERCHANT_ID && process.env.CARDNET_API_KEY);
}

export const cardnetProvider: PaymentProvider = {
  id: "cardnet",
  label: "CardNet",
  isConfigured: isCardnetConfigured,
  async createCheckoutSession() {
    throw new Error("CARDNET_NOT_YET_IMPLEMENTED");
  },
};
