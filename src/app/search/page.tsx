import type { Metadata } from "next";
import { SearchResultsClient } from "@/components/search-results-client";
import type { VehicleCardData } from "@/components/vehicle-card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { attachVerifiedFlag } from "@/lib/vehicle-verification";
import { defaultDateRange } from "@/lib/default-date-range";
import { drDestinations, findDestinationPhoto } from "@/lib/destinations";

// Live filtering (dates, price, "near me") happens client-side same as
// before — this only seeds the very first paint with results matching
// whatever URL was actually requested, so a shared/indexed search link
// shows real cars immediately instead of an empty grid.
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

async function loadInitialVehicles(city: string, params: Awaited<PageProps["searchParams"]>): Promise<VehicleCardData[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("vehicles").select("*").eq("status", "published");
  if (city) query = query.ilike("location_city", `%${city}%`);
  const transmission = firstValue(params.transmission);
  const minPrice = firstValue(params.minPrice);
  const maxPrice = firstValue(params.maxPrice);
  const seats = firstValue(params.seats);
  if (transmission) query = query.eq("transmission", transmission);
  if (minPrice && Number.isFinite(Number(minPrice))) query = query.gte("daily_price", Number(minPrice));
  if (maxPrice && Number.isFinite(Number(maxPrice))) query = query.lte("daily_price", Number(maxPrice));
  if (seats && Number.isFinite(Number(seats))) query = query.gte("seats", Number(seats));

  const { data } = await query.order("promoted", { ascending: false }).order("created_at", { ascending: false }).limit(24);
  return attachVerifiedFlag(supabase, (data ?? []) as VehicleCardData[]);
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const destination = firstValue(params.location) || firstValue(params.destination);
  const title = destination ? `Cars in ${destination}, Dominican Republic | yoRento` : "Search cars | yoRento";
  const description = destination
    ? `Compare car rentals in ${destination}, Dominican Republic on yoRento — real listings from personal owners and rental businesses, prices shown upfront.`
    : "Compare car rentals across the Dominican Republic on yoRento — real listings from personal owners and rental businesses, prices shown upfront.";
  const photo = findDestinationPhoto(destination || null);

  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: photo, width: 1600, height: 900, alt: destination || "yoRento" }] },
    twitter: { card: "summary_large_image", title, description, images: [photo] },
  };
}

export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const destination = firstValue(params.location) || firstValue(params.destination) || drDestinations[0].name;
  const fallbackDates = defaultDateRange();
  const startDate = firstValue(params.startDate) || fallbackDates.start;
  const endDate = firstValue(params.endDate) || fallbackDates.end;

  const vehicles = await loadInitialVehicles(destination, params);

  return (
    <SearchResultsClient
      initialDestination={destination}
      initialStartDate={startDate}
      initialEndDate={endDate}
      initialVehicles={vehicles}
    />
  );
}
