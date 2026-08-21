import type { SupabaseClient } from "@supabase/supabase-js";

// Which destinations actually have something to show — a city with
// zero published vehicles is a dead end for a browsing visitor, so
// destination grids/teasers filter down to this set. The location
// pickers (search bar, "list your car") intentionally do NOT use
// this — a host still needs to be able to pick any city to post the
// first car there.
export async function getActiveDestinationCities(supabase: SupabaseClient): Promise<Set<string>> {
  const { data } = await supabase.from("vehicles").select("location_city").eq("status", "published");
  return new Set((data ?? []).map((row) => normalizeCityName(row.location_city as string)));
}

export function normalizeCityName(city: string): string {
  return (city ?? "").trim().toLowerCase();
}
