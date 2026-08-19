import type { SupportedLanguage } from "@/lib/marketplace-config";

export interface CurrencyRate {
  currency: string;
  usd_rate: number;
}

// A simple default of "which currency does this reader probably think
// in" based on the active UI language. Not a real preference system —
// there's no per-user currency setting yet — but it's a reasonable
// default until one exists.
export const defaultCurrencyByLanguage: Record<SupportedLanguage, string> = {
  en: "USD",
  es: "DOP",
  fr: "EUR",
};

// rates are USD-per-unit-of-currency (e.g. DOP: 60 means 60 DOP = 1 USD).
export function convertApprox(amount: number, fromCurrency: string, toCurrency: string, rates: CurrencyRate[]): number | null {
  if (fromCurrency === toCurrency) return amount;
  const from = rates.find((rate) => rate.currency === fromCurrency);
  const to = rates.find((rate) => rate.currency === toCurrency);
  if (!from || !to) return null;
  const usdAmount = amount / from.usd_rate;
  return usdAmount * to.usd_rate;
}
