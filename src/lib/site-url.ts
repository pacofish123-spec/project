// Same fallback convention as layout.tsx's siteUrl — used anywhere a
// server route needs to build an absolute redirect URL (payment
// success/cancel pages, Stripe Connect onboarding links, Identity
// return URLs) that a third-party processor can follow.
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://project-xi-seven-12.vercel.app";
}
