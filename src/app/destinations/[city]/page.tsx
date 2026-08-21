import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import type { VehicleCardData } from "@/components/vehicle-card";
import { DestinationDetailClient } from "@/components/destination-detail-client";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { attachVerifiedFlag } from "@/lib/vehicle-verification";
import { findDestinationBySlug } from "@/lib/destinations";

// Vehicle availability changes as hosts publish/pause listings — this
// page always reflects the live count/list rather than a stale build.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ city: string }>;
}

async function loadCityVehicles(cityName: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("vehicles")
    .select("*")
    .eq("status", "published")
    .ilike("location_city", `%${cityName}%`)
    .order("promoted", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(6);

  const vehicles = (data ?? []) as VehicleCardData[];
  return attachVerifiedFlag(supabase, vehicles);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city } = await params;
  const destination = findDestinationBySlug(city);
  if (!destination) return { title: "Destination not found | yoRento" };

  const title = `Car rentals in ${destination.name}, Dominican Republic | yoRento`;
  const description = `Compare car rentals in ${destination.name}, Dominican Republic on yoRento — real listings from personal owners and rental businesses, prices shown upfront.`;

  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: destination.photo, width: 1600, height: 900, alt: destination.name }] },
    twitter: { card: "summary_large_image", title, description, images: [destination.photo] },
  };
}

export default async function DestinationDetailPage({ params }: PageProps) {
  const { city } = await params;
  const destination = findDestinationBySlug(city);
  if (!destination) notFound();

  const vehicles = await loadCityVehicles(destination.name);

  return (
    <>
      <AppHeader />
      <DestinationDetailClient destination={destination} vehicles={vehicles} />
    </>
  );
}
