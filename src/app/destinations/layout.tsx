import type { Metadata } from "next";
import type { ReactNode } from "react";

// Default for /destinations itself; /destinations/[city]/page.tsx sets
// its own dynamic metadata via generateMetadata, which overrides this.
export const metadata: Metadata = {
  title: "Destinations | yoRento",
  description: "Explore cities across the Dominican Republic where yoRento hosts have cars ready to rent.",
};

export default function DestinationsLayout({ children }: { children: ReactNode }) {
  return children;
}
