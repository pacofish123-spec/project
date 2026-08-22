import type { MetadataRoute } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveDestinationCities, normalizeCityName } from "@/lib/active-cities";
import { drDestinations, slugifyDestination } from "@/lib/destinations";
import { getSiteUrl } from "@/lib/site-url";

// Regenerated per-request (not statically cached) — inventory changes
// as hosts publish/pause vehicles, and a stale sitemap pointing at a
// delisted car is worse than a slightly slower crawl.
export const dynamic = "force-dynamic";

const staticRoutes = ["", "/search", "/destinations", "/trust", "/about", "/terms", "/privacy"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const supabase = await createSupabaseServerClient();

  const [{ data: vehicles }, activeCities] = await Promise.all([
    supabase.from("vehicles").select("id, updated_at").eq("status", "published"),
    getActiveDestinationCities(supabase),
  ]);

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.6,
  }));

  const vehicleEntries: MetadataRoute.Sitemap = (vehicles ?? []).map((vehicle) => ({
    url: `${siteUrl}/vehicles/${vehicle.id}`,
    lastModified: vehicle.updated_at ? new Date(vehicle.updated_at) : new Date(),
    changeFrequency: "daily",
    priority: 0.8,
  }));

  // Only curated destinations that actually have a published car —
  // same rule the homepage and /destinations use, so the sitemap never
  // points crawlers at a dead-end city page.
  const destinationEntries: MetadataRoute.Sitemap = drDestinations
    .filter((destination) => activeCities.has(normalizeCityName(destination.name)))
    .map((destination) => ({
      url: `${siteUrl}/destinations/${slugifyDestination(destination.name)}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    }));

  return [...staticEntries, ...vehicleEntries, ...destinationEntries];
}
