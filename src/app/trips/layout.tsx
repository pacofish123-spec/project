import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "My Trips | yoRento" };

export default function TripsLayout({ children }: { children: ReactNode }) {
  return children;
}
