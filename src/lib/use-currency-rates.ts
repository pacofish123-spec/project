"use client";

import { useEffect, useState } from "react";
import type { CurrencyRate } from "@/lib/currency";

// Module-scoped so every component mounting this hook in the same SPA
// session shares one fetch instead of each page (home, search, ...)
// re-querying Postgres for FX rates that realistically change a few
// times a day at most.
const CACHE_TTL_MS = 30 * 60 * 1000;
let cache: { rates: CurrencyRate[]; fetchedAt: number } | null = null;
let inFlight: Promise<CurrencyRate[]> | null = null;

function loadRates(): Promise<CurrencyRate[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return Promise.resolve(cache.rates);
  if (inFlight) return inFlight;
  inFlight = fetch("/api/currency-rates")
    .then(async (response) => {
      const result = await response.json() as { rates?: CurrencyRate[] };
      const rates = response.ok ? result.rates ?? [] : [];
      cache = { rates, fetchedAt: Date.now() };
      return rates;
    })
    .catch(() => [])
    .finally(() => { inFlight = null; });
  return inFlight;
}

export function useCurrencyRates(): CurrencyRate[] | undefined {
  const [rates, setRates] = useState<CurrencyRate[] | undefined>(cache?.rates);

  useEffect(() => {
    let cancelled = false;
    loadRates().then((result) => { if (!cancelled) setRates(result); });
    return () => { cancelled = true; };
  }, []);

  return rates;
}
