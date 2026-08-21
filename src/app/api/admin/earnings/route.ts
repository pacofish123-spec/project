import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/authorization";

type Granularity = "day" | "week" | "month" | "year";

function bucketKey(date: Date, granularity: Granularity): string {
  if (granularity === "year") return String(date.getUTCFullYear());
  if (granularity === "month") return date.toISOString().slice(0, 7);
  if (granularity === "week") {
    // ISO week: Monday-anchored bucket, keyed by that Monday's date.
    const day = (date.getUTCDay() + 6) % 7; // 0 = Monday
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() - day);
    return monday.toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

function parseGranularity(value: string | null): Granularity {
  return value === "week" || value === "month" || value === "year" ? value : "day";
}

export async function GET(request: Request) {
  try {
    const { supabase } = await requireCapability("can_manage_platform");
    const url = new URL(request.url);
    const granularity = parseGranularity(url.searchParams.get("granularity"));

    const now = new Date();
    const defaultStart = new Date(now);
    defaultStart.setUTCDate(defaultStart.getUTCDate() - 29);
    const start = url.searchParams.get("start") ? new Date(url.searchParams.get("start")!) : defaultStart;
    const end = url.searchParams.get("end") ? new Date(url.searchParams.get("end")!) : now;
    const requestedCurrency = url.searchParams.get("currency");

    // Equal-length window immediately before `start`, for the vs-previous-period delta.
    const spanMs = Math.max(end.getTime() - start.getTime(), 24 * 60 * 60 * 1000);
    const previousStart = new Date(start.getTime() - spanMs);
    const previousEnd = new Date(start.getTime() - 1);

    const { data, error } = await supabase
      .from("bookings")
      .select("created_at, total, platform_fee, currency, status")
      .not("status", "in", "(requested,declined,cancelled)")
      .gte("created_at", previousStart.toISOString())
      .lte("created_at", end.toISOString());
    if (error) return NextResponse.json({ error: "Unable to load earnings." }, { status: 500 });

    const rows = data ?? [];
    const currencies = [...new Set(rows.map((row) => row.currency))].sort();

    const currentRows = rows.filter((row) => new Date(row.created_at) >= start && new Date(row.created_at) <= end);
    const bookingsByCurrency = new Map<string, number>();
    for (const row of currentRows) bookingsByCurrency.set(row.currency, (bookingsByCurrency.get(row.currency) ?? 0) + 1);
    const defaultCurrency = [...bookingsByCurrency.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? currencies[0] ?? "DOP";
    const currency = requestedCurrency && currencies.includes(requestedCurrency) ? requestedCurrency : defaultCurrency;

    function totalsFor(subset: typeof rows) {
      return subset.reduce(
        (acc, row) => ({ gross: acc.gross + (Number(row.total) || 0), platformFee: acc.platformFee + (Number(row.platform_fee) || 0), bookings: acc.bookings + 1 }),
        { gross: 0, platformFee: 0, bookings: 0 },
      );
    }

    const currentCurrencyRows = currentRows.filter((row) => row.currency === currency);
    const previousCurrencyRows = rows.filter((row) => row.currency === currency && new Date(row.created_at) >= previousStart && new Date(row.created_at) <= previousEnd);

    const bucketed = new Map<string, { gross: number; platformFee: number; bookings: number }>();
    for (const row of currentCurrencyRows) {
      const key = bucketKey(new Date(row.created_at), granularity);
      const entry = bucketed.get(key) ?? { gross: 0, platformFee: 0, bookings: 0 };
      entry.gross += Number(row.total) || 0;
      entry.platformFee += Number(row.platform_fee) || 0;
      entry.bookings += 1;
      bucketed.set(key, entry);
    }
    const series = [...bucketed.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([bucket, totals]) => ({ bucket, ...totals }));

    return NextResponse.json({
      currencies,
      currency,
      granularity,
      range: { start: start.toISOString(), end: end.toISOString() },
      series,
      totals: totalsFor(currentCurrencyRows),
      previousTotals: totalsFor(previousCurrencyRows),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "CAPABILITY_REQUIRED" ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? "Admin access required." : "Unable to load earnings." }, { status });
  }
}
