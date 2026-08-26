import type { Metadata } from "next";
import type { ReactNode } from "react";

// Applies to /host (the public "become a host" landing page); the
// dashboard/vehicles/payouts/extras/business/cars subroutes are all
// robots-disallowed account areas and don't need their own SEO title.
export const metadata: Metadata = {
  title: "Become a Host | yoRento",
  description: "List your vehicle and start earning with yoRento's trusted marketplace.",
};

export default function HostLayout({ children }: { children: ReactNode }) {
  return children;
}
