"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/admin/verification", label: "Verification" },
  { href: "/admin/users", label: "Directory" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/duplicates", label: "Duplicates" },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav className="admin-tabs">
      {tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} className={pathname.startsWith(tab.href) ? "active" : ""}>{tab.label}</Link>
      ))}
    </nav>
  );
}
