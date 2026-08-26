import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Sign Up | yoRento" };

export default function SignUpLayout({ children }: { children: ReactNode }) {
  return children;
}
