import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Trust & Safety | yoRento",
  description: "How yoRento verifies hosts and renters, protects deposits, and keeps every trip covered.",
};

export default function TrustLayout({ children }: { children: ReactNode }) {
  return children;
}
