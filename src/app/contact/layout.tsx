import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Contact Us | yoRento",
  description: "Get in touch with the yoRento team — questions, issues, or feedback.",
};

export default function ContactLayout({ children }: { children: ReactNode }) {
  return children;
}
