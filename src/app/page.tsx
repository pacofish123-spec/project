import { HomeClient } from "@/components/home-client";
import type { VehicleCardData } from "@/components/vehicle-card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { attachVerifiedFlag } from "@/lib/vehicle-verification";

// Featured vehicles are fetched server-side so the homepage's initial
// HTML has real listing content for search engines and link-preview
// bots, instead of an empty grid that only fills in after a client
// fetch. Availability changes as hosts publish/pause vehicles, so this
// stays a live per-request fetch rather than a cached static build.
export const dynamic = "force-dynamic";

async function loadFeaturedVehicles(): Promise<VehicleCardData[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("vehicles")
    .select("*")
    .eq("status", "published")
    .order("promoted", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(6);

  return attachVerifiedFlag(supabase, (data ?? []) as VehicleCardData[]);
}

export default async function Home() {
  const vehicles = await loadFeaturedVehicles();
  return <HomeClient initialVehicles={vehicles} />;
}
