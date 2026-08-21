import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("currency_rates").select("currency, usd_rate");
    if (error) return NextResponse.json({ error: "Unable to load currency rates." }, { status: 500 });
    // FX rates change at most a few times a day and don't vary per user —
    // safe to cache. Every page that mounts useCurrencyRates() was
    // otherwise hitting Postgres on every navigation.
    return NextResponse.json({ rates: data }, { headers: { "Cache-Control": "public, max-age=1800, stale-while-revalidate=3600" } });
  } catch {
    return NextResponse.json({ error: "Unable to load currency rates." }, { status: 500 });
  }
}
