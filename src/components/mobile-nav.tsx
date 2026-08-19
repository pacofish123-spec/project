"use client";

import { CarFront, ClipboardList, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useLanguage } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/translations";

const tabs = [
  { key: "browse", root: "/", icon: Search, labelKey: "backLinkBrowse" as TranslationKey },
  { key: "trips", root: "/trips", icon: ClipboardList, labelKey: "authMyTrips" as TranslationKey },
  { key: "host", root: "/host", icon: CarFront, labelKey: "mobileNavMyCars" as TranslationKey },
  { key: "profile", root: "/profile", icon: UserRound, labelKey: "mobileNavProfile" as TranslationKey },
];

function tabForPath(pathname: string) {
  return tabs.find((tab) => pathname === tab.root || (tab.root !== "/" && pathname.startsWith(tab.root))) ?? tabs[0];
}

export function MobileNav() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const activeTab = tabForPath(pathname);
  useEffect(() => {
    sessionStorage.setItem(`yorento-tab:${activeTab.key}`, pathname);
  }, [activeTab.key, pathname]);

  function navigate(tab: (typeof tabs)[number]) {
    if (tab.key === activeTab.key) {
      router.push(tab.root);
      return;
    }
    const savedPath = sessionStorage.getItem(`yorento-tab:${tab.key}`);
    router.push(savedPath?.startsWith(tab.root) ? savedPath : tab.root);
  }

  return <nav className="mobile-bottom-nav" aria-label="Mobile navigation">{tabs.map((tab) => { const Icon = tab.icon; return <Link className={`mobile-tab ${tab.key === activeTab.key ? "active" : ""} ${tab.key === "host" ? "host-tab" : ""}`} href={tab.root} key={tab.key} onClick={(event) => { event.preventDefault(); navigate(tab); }}><Icon size={19} /><span>{t(tab.labelKey)}</span></Link>; })}</nav>;
}
