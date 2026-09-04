"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/vehicles", label: "Vehicles" },
  { href: "/admin/verification", label: "Verification" },
];

export function AdminTabs() {
  const pathname = usePathname();
  const scrollerRef = useRef<HTMLElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // There's no visual cue at all that this bar scrolls (no arrows, no
  // native scrollbar most platforms bother rendering) — on a narrower
  // window the tab list overflows with zero indication anything's cut
  // off, let alone how to reach it. Track scroll position so arrows
  // only show up on the side that actually has more to reveal.
  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState]);

  // Re-check after navigating tabs (the active pill's width — bolder
  // font, coral fill — can shift the overflow point) and once the
  // fonts/layout have actually settled, not just mounted.
  useEffect(() => {
    updateScrollState();
    const id = requestAnimationFrame(updateScrollState);
    return () => cancelAnimationFrame(id);
  }, [pathname, updateScrollState]);

  function scrollByAmount(amount: number) {
    scrollerRef.current?.scrollBy({ left: amount, behavior: "smooth" });
  }

  return (
    <div className={`admin-tabs-wrap ${canScrollLeft ? "can-scroll-left" : ""} ${canScrollRight ? "can-scroll-right" : ""}`}>
      {canScrollLeft && (
        <button type="button" className="admin-tabs-arrow left" aria-label="Scroll tabs left" onClick={() => scrollByAmount(-180)}>
          <ChevronLeft size={16} />
        </button>
      )}
      <nav className="admin-tabs" ref={scrollerRef}>
        {tabs.map((tab) => (
          <Link key={tab.href} href={tab.href} className={pathname === tab.href ? "active" : ""}>{tab.label}</Link>
        ))}
      </nav>
      {canScrollRight && (
        <button type="button" className="admin-tabs-arrow right" aria-label="Scroll tabs right" onClick={() => scrollByAmount(180)}>
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}
