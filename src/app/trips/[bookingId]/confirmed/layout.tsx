import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Booking Confirmed | yoRento" };

export default function BookingConfirmedLayout({ children }: { children: ReactNode }) {
  return children;
}
