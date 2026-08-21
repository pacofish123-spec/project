import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { VehicleDetailClient, type Vehicle, type HostSummary } from "@/components/vehicle-detail-client";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";

interface PageProps {
  params: Promise<{ vehicleId: string }>;
}

async function loadVehicle(vehicleId: string): Promise<Vehicle | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("vehicles").select("*").eq("id", vehicleId).maybeSingle();
  if (error || !data) return null;

  const { data: verificationRecord } = await supabase
    .from("verification_records")
    .select("id")
    .eq("vehicle_id", vehicleId)
    .eq("verification_type", "vehicle")
    .eq("status", "verified")
    .maybeSingle();

  return { ...data, verified: Boolean(verificationRecord) } as Vehicle;
}

async function loadHostSummary(ownerUserId: string): Promise<HostSummary | null> {
  const supabase = await createSupabaseServerClient();
  const [{ data: profile }, { data: stats }] = await Promise.all([
    supabase.from("public_profiles").select("id, display_name, avatar_url, member_since").eq("id", ownerUserId).maybeSingle(),
    supabase.from("public_host_profiles").select("rating, completed_rentals, response_rate").eq("user_id", ownerUserId).maybeSingle(),
  ]);
  if (!profile) return null;
  return { ...profile, rating: stats?.rating ?? null, completed_rentals: stats?.completed_rentals ?? 0, response_rate: stats?.response_rate ?? null };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { vehicleId } = await params;
  const vehicle = await loadVehicle(vehicleId);
  if (!vehicle) return { title: "Vehicle not found | yoRento" };

  const title = `${vehicle.make} ${vehicle.model} ${vehicle.year} in ${vehicle.location_city} | yoRento`;
  const description = `Rent a ${vehicle.year} ${vehicle.make} ${vehicle.model} in ${vehicle.location_city}, Dominican Republic — ${formatMoney(vehicle.daily_price, vehicle.base_currency)} per day on yoRento.`;
  const ogImageUrl = `/vehicles/${vehicleId}/opengraph-image`;

  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `${vehicle.make} ${vehicle.model}` }] },
    twitter: { card: "summary_large_image", title, description, images: [ogImageUrl] },
  };
}

export default async function VehicleDetailPage({ params }: PageProps) {
  const { vehicleId } = await params;
  const vehicle = await loadVehicle(vehicleId);
  if (!vehicle) notFound();
  const host = await loadHostSummary((vehicle as unknown as { owner_user_id: string }).owner_user_id);

  return (
    <>
      <AppHeader />
      <VehicleDetailClient vehicleId={vehicleId} initialVehicle={vehicle} host={host} />
    </>
  );
}
