import { HomeClient } from "@/components/home-client";
import type { VehicleCardData } from "@/components/vehicle-card";
import type { PublicReview } from "@/components/public-reviews";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { attachTrustBadges } from "@/lib/vehicle-verification";
import { getActiveDestinationCities } from "@/lib/active-cities";

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

  return attachTrustBadges(supabase, (data ?? []) as VehicleCardData[]);
}

// Only ever reviews whose author explicitly consented to public
// display (consent_public, migration 0042) — "anyone can read reviews"
// (0029) makes every row technically readable, this query is the
// filter that keeps the homepage feed opt-in.
async function loadPublicReviews(): Promise<PublicReview[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("reviews")
    .select("id, rating, body, author:profiles!reviews_author_user_id_fkey(display_name, avatar_url), vehicles(make, model)")
    .eq("consent_public", true)
    .order("created_at", { ascending: false })
    .limit(6);

  return (data ?? []).map((review) => {
    const author = Array.isArray(review.author) ? review.author[0] : review.author;
    const vehicle = Array.isArray(review.vehicles) ? review.vehicles[0] : review.vehicles;
    return {
      id: review.id,
      rating: review.rating,
      body: review.body,
      author_display_name: author?.display_name ?? null,
      author_avatar_url: author?.avatar_url ?? null,
      vehicle_label: vehicle ? `${vehicle.make} ${vehicle.model}` : null,
    };
  });
}

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const [vehicles, activeCities, reviews] = await Promise.all([
    loadFeaturedVehicles(),
    getActiveDestinationCities(supabase),
    loadPublicReviews(),
  ]);
  return <HomeClient initialVehicles={vehicles} activeCities={[...activeCities]} reviews={reviews} />;
}
