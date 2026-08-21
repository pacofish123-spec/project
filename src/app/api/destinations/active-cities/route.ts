import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveDestinationCities } from "@/lib/active-cities";

// Public, unauthenticated — this only ever reveals which cities have a
// published vehicle, the same information already visible by browsing
// /search per-city.
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const cities = await getActiveDestinationCities(supabase);
  return NextResponse.json({ cities: [...cities] });
}
