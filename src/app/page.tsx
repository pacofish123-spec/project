"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { MobileNav } from "@/components/mobile-nav";
import { HomeSearch } from "@/components/home-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthStatus } from "@/components/auth-status";
import { VehicleCard, type VehicleCardData } from "@/components/vehicle-card";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LanguageDropdown } from "@/components/language-dropdown";
import { NotificationBell } from "@/components/notification-bell";
import { useLanguage } from "@/lib/i18n";
import { useCurrencyRates } from "@/lib/use-currency-rates";
import {
  ArrowRight,
  CarFront,
  Compass,
  Globe2,
  MapPin,
  Menu,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";

export default function Home() {
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hostFilter, setHostFilter] = useState("All vehicles");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [vehicles, setVehicles] = useState<VehicleCardData[] | null>(null);
  const rates = useCurrencyRates();

  useEffect(() => {
    fetch("/api/vehicles").then(async (response) => {
      const result = await response.json() as { vehicles?: VehicleCardData[] };
      setVehicles(response.ok ? (result.vehicles ?? []).slice(0, 6) : []);
    }).catch(() => setVehicles([]));
  }, []);

  const filteredVehicles = (vehicles ?? []).filter((vehicle) =>
    hostFilter === "All vehicles" ||
    (hostFilter === "Personal owners" && vehicle.host_type === "individual") ||
    (hostFilter === "Businesses" && vehicle.host_type === "business"),
  );

  const destinations = [
    { name: "Punta Cana", detail: t("destPuntaCanaDetail"), image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80" },
    { name: "Santo Domingo", detail: t("destSantoDomingoDetail"), image: "https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?auto=format&fit=crop&w=900&q=80" },
    { name: "Samaná", detail: t("destSamanaDetail"), image: "https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?auto=format&fit=crop&w=900&q=80" },
  ];

  return (
    <main>
      <section className="hero-shell">
        <nav className="site-nav page-width">
          <Link className="brand" href="/" aria-label="yoRento home"><Brand light /></Link>
          <div className="desktop-nav"><a href="#cars">{t("navExploreCars")}</a><a href="#destinations">{t("navDestinations")}</a><a href="#trust">{t("navWhyYorento")}</a></div>
          <div className="nav-actions"><LanguageDropdown /><ThemeToggle /><a className="host-link" href="/host">{t("listYourCar")} <ArrowRight size={15} /></a><NotificationBell /><AuthStatus /><button className="menu-button" aria-label="Open menu" onClick={() => setMenuOpen(true)}><Menu size={22} /></button></div>
        </nav>
        {menuOpen && <div className="mobile-menu"><div className="mobile-menu-panel"><div className="mobile-menu-header"><Link className="menu-brand" href="/" onClick={() => setMenuOpen(false)}><Brand /></Link><button className="close-menu" aria-label="Close menu" onClick={() => setMenuOpen(false)}><X /></button></div><p className="menu-kicker">{t("menuKicker")}</p><div className="mobile-menu-links"><a className="menu-item" href="#cars" onClick={() => setMenuOpen(false)}><span className="menu-icon"><Compass size={19} /></span><span><strong>{t("navExploreCars")}</strong><small>{t("menuExploreCarsDetail")}</small></span><ArrowRight size={17} /></a><a className="menu-item" href="#destinations" onClick={() => setMenuOpen(false)}><span className="menu-icon"><MapPin size={19} /></span><span><strong>{t("navDestinations")}</strong><small>{t("menuDestinationsDetail")}</small></span><ArrowRight size={17} /></a><a className="menu-item" href="/host" onClick={() => setMenuOpen(false)}><span className="menu-icon"><CarFront size={19} /></span><span><strong>{t("listYourCar")}</strong><small>{t("menuListYourCarDetail")}</small></span><ArrowRight size={17} /></a><a className="menu-item" href="#trust" onClick={() => setMenuOpen(false)}><span className="menu-icon"><ShieldCheck size={19} /></span><span><strong>{t("navWhyYorento")}</strong><small>{t("menuWhyYorentoDetail")}</small></span><ArrowRight size={17} /></a></div><div className="mobile-menu-bottom"><span>{t("menuAlreadyHaveAccount")}</span><a href="/sign-in" onClick={() => setMenuOpen(false)}>{t("signIn")} <ArrowRight size={15} /></a></div><div className="mobile-menu-lang"><LanguageSwitcher /></div></div></div>}

        <div className="hero-content page-width" id="top">
          <div className="hero-copy"><p className="eyebrow"><span className="eyebrow-line" /> {t("heroEyebrow")}</p><h1>{t("heroTitleLine1")}<br /><em>{t("heroTitleLine2")}</em></h1><p className="hero-description">{t("heroDescription")}</p></div>
          <HomeSearch />
          <div className="hero-note"><ShieldCheck size={17} /> {t("heroNote")}</div>
        </div>
      </section>

      <section className="section page-width" id="cars">
        <div className="section-heading"><div><p className="eyebrow muted">{t("readyWhenYouAre")}</p><h2>{t("carsHeadingLine1")} <em>{t("carsHeadingLine2")}</em></h2></div><a className="text-link" href="/search">{t("viewAllCars")} <ArrowRight size={16} /></a></div>
        <div className="filter-row"><div className="filter-tabs">{["All vehicles", "Personal owners", "Businesses"].map((filter) => <button key={filter} className={hostFilter === filter ? "active" : ""} onClick={() => setHostFilter(filter)}>{filter === "All vehicles" ? t("filterAll") : filter === "Personal owners" ? t("filterPersonal") : t("filterBusiness")}</button>)}</div><button className="filter-button" onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={16} /> {t("filters")}</button></div>
        {filtersOpen && <div className="filter-panel"><span>{t("moreFilters")}</span><button onClick={() => setFiltersOpen(false)}>{t("filterAutomatic")}</button><button onClick={() => setFiltersOpen(false)}>{t("filterSeats")}</button><button onClick={() => setFiltersOpen(false)}>{t("filterAc")}</button></div>}
        {vehicles === null && <p className="workflow-kicker">{t("loadingVehicles")}</p>}
        {vehicles !== null && filteredVehicles.length > 0 && <div className="vehicle-grid">{filteredVehicles.map((vehicle) => <VehicleCard vehicle={vehicle} rates={rates} key={vehicle.id} />)}</div>}
        {vehicles !== null && filteredVehicles.length === 0 && <section className="empty-results compact"><CarFront size={32} /><h2>{t("noVehiclesTitle")}</h2><p>{t("noVehiclesBody")}</p><Link className="workflow-submit coral" href="/host">{t("listAVehicle")} <ArrowRight size={16} /></Link></section>}
      </section>

      <section className="trust-strip" id="trust"><div className="page-width trust-grid"><div><ShieldCheck size={25} /><h3>{t("trustBuiltInTitle")}</h3><p>{t("trustBuiltInBody")}</p></div><div><Sparkles size={25} /><h3>{t("madeForJourneyTitle")}</h3><p>{t("madeForJourneyBody")}</p></div><div><Globe2 size={25} /><h3>{t("oneAccountTitle")}</h3><p>{t("oneAccountBody")}</p></div></div></section>

      <section className="section page-width" id="destinations"><div className="section-heading"><div><p className="eyebrow muted">{t("startSomewhereBeautiful")}</p><h2>{t("whereWillYouGoLine1")} <em>{t("whereWillYouGoLine2")}</em></h2></div><a className="text-link" href="/search">{t("exploreDestinations")} <ArrowRight size={16} /></a></div><div className="destination-grid">{destinations.map((destination) => <a className="destination-card" href={`/search?destination=${encodeURIComponent(destination.name)}`} key={destination.name} style={{ backgroundImage: `url(${destination.image})` }}><div><strong>{destination.name}</strong><span>{destination.detail}</span></div><ArrowRight size={18} /></a>)}</div></section>

      <section className="host-cta page-width" id="host"><div><p className="eyebrow">{t("forOwnersBusinesses")}</p><h2>{t("rentCarLine1")}<br /><em>{t("rentCarLine2")}</em></h2><p>{t("hostCtaBody")}</p><a className="button-light" href="/host">{t("becomeAHost")} <ArrowRight size={16} /></a></div><div className="host-stat"><span>01</span><strong>{t("hostStat1Line1")}<br />{t("hostStat1Line2")}</strong><span>02</span><strong>{t("hostStat2Line1")}<br />{t("hostStat2Line2")}</strong></div></section>

      <footer className="site-footer"><div className="page-width footer-inner"><a className="brand" href="#top"><Brand light /></a><p>{t("footerTagline")}</p><div><a href="/about">{t("about")}</a><a href="/host">{t("host")}</a><a href="/trust">{t("trustSafety")}</a><LanguageSwitcher /></div></div></footer>
      <MobileNav />
    </main>
  );
}
