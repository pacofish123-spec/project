import type { Metadata } from "next";
import type { ReactNode } from "react";

// /about's page.tsx is a client component, so metadata can't be
// exported from it directly — this thin server layout carries the
// page-specific title/description instead of every visitor's tab (and
// every shared link) just showing the site-wide default.
export const metadata: Metadata = {
  title: "About | yoRento",
  description: "Learn about yoRento, a trusted vehicle marketplace born in the Dominican Republic.",
};

export default function AboutLayout({ children }: { children: ReactNode }) {
  return children;
}
