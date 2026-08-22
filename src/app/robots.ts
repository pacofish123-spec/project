import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

// Everything content-worthy (home, /search, vehicle/destination pages,
// legal/trust pages) stays crawlable; account-gated and admin-only
// routes are excluded since a crawler can't do anything useful with
// them and indexing them is pure noise.
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/api/",
        "/host/dashboard",
        "/host/vehicles",
        "/host/payouts",
        "/host/extras",
        "/host/business",
        "/host/cars",
        "/trips",
        "/messages/",
        "/profile",
        "/verify-id",
        "/onboarding/",
        "/auth/",
        "/sign-in",
        "/sign-up",
        "/recover",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
