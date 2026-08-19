"use client";

import { useEffect, useState } from "react";
import type { CurrencyRate } from "@/lib/currency";

export function useCurrencyRates(): CurrencyRate[] | undefined {
  const [rates, setRates] = useState<CurrencyRate[] | undefined>(undefined);

  useEffect(() => {
    fetch("/api/currency-rates").then(async (response) => {
      const result = await response.json() as { rates?: CurrencyRate[] };
      if (response.ok) setRates(result.rates ?? []);
    }).catch(() => {});
  }, []);

  return rates;
}
