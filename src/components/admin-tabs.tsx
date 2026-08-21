"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Overview always leads — it's the landing dashboard (pending tasks,
// counts, earnings summary). Everything else is alphabetical.
const tabs = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/businesses", label: "Businesses" },
  { href: "/admin/disputes", label: "Disputes" },
  { href: "/admin/duplicates", label: "Duplicates" },
  { href: "/admin/earnings", label: "Earnings" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/vehicles", label: "Vehicles" },
  { href: "/admin/verification", label: "Verification" },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav className="admin-tabs">
      {tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} className={pathname === tab.href ? "active" : ""}>{tab.label}</Link>
      ))}
    </nav>
  );
}
