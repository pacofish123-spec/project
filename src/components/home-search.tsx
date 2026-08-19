"use client";

import { CalendarDays, CarFront, ChevronDown, Check, MapPin, Search, X } from "lucide-react";
import { Drawer } from "vaul";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarPicker } from "@/components/calendar-picker";
import { useLanguage, localeByLanguage } from "@/lib/i18n";

const locations = ["Dominican Republic", "United States", "Canada", "Mexico", "Puerto Rico", "Colombia", "Brazil", "France", "Spain", "Italy", "Germany", "United Kingdom"];

export function HomeSearch() {
  const { t, language } = useLanguage();
  const vehicleTypes = [t("anyVehicleLabel"), t("vehicleTypeEconomy"), t("vehicleTypeSuv"), t("vehicleTypeLuxury"), t("vehicleTypeVan"), t("vehicleTypePickup")];
  const router = useRouter();
  const [locationOpen, setLocationOpen] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [location, setLocation] = useState("Dominican Republic");
  const [locationQuery, setLocationQuery] = useState("");
  const [vehicleType, setVehicleType] = useState(vehicleTypes[0]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dateError, setDateError] = useState("");

  function readableDate(value: string) {
    if (!value) return t("chooseDateFallback");
    return new Date(`${value}T12:00:00`).toLocaleDateString(localeByLanguage[language], { month: "short", day: "numeric" });
  }

  const dateSummary = startDate && endDate ? `${readableDate(startDate)} - ${readableDate(endDate)}` : startDate ? `${readableDate(startDate)} - ${t("returnDateWord")}` : t("addDatesLabel");
  const filteredLocations = locations.filter((option) => option.toLowerCase().includes(locationQuery.toLowerCase()));

  function applyDates() {
    if (!startDate || !endDate) { setDateError(t("searchDatesRequiredError")); return; }
    setDateError(""); setDatesOpen(false);
  }

  function search() {
    const params = new URLSearchParams({ location, vehicleType });
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    router.push(`/search?${params.toString()}`);
  }

  return <div className="search-panel" aria-label="Search vehicles">
    <Drawer.Root open={locationOpen} onOpenChange={setLocationOpen}><Drawer.Trigger asChild><button className="search-field" type="button"><MapPin size={18} /><span><small>{t("whereLabel")}</small><strong>{location}</strong></span><ChevronDown size={16} /></button></Drawer.Trigger><Drawer.Portal><Drawer.Overlay className="drawer-overlay" /><Drawer.Content className="drawer-content home-drawer"><div className="drawer-handle" /><div className="drawer-heading"><Drawer.Title className="drawer-title">{t("whereAreYouGoingTitle")}</Drawer.Title><button className="drawer-close" type="button" aria-label="Close location picker" onClick={() => setLocationOpen(false)}><X size={18} /></button></div><p className="drawer-description">{t("startInDrBody")}</p><input className="location-search" value={locationQuery} onChange={(event) => setLocationQuery(event.target.value)} placeholder={t("searchCountryPlaceholder")} aria-label="Search countries" /><div className="drawer-options">{filteredLocations.map((option, index) => <button className={`select-option ${index === 0 && !locationQuery ? "featured-location" : ""}`} type="button" key={option} onClick={() => { setLocation(option); setLocationQuery(""); setLocationOpen(false); }}>{index === 0 && !locationQuery && <MapPin size={17} />}{option}{location === option && <Check size={18} />}</button>)}</div></Drawer.Content></Drawer.Portal></Drawer.Root>
    <Drawer.Root open={datesOpen} onOpenChange={setDatesOpen}><Drawer.Trigger asChild><button className="search-field" type="button"><CalendarDays size={18} /><span><small>{t("pickupReturnLabel")}</small><strong>{dateSummary}</strong></span></button></Drawer.Trigger><Drawer.Portal><Drawer.Overlay className="drawer-overlay" /><Drawer.Content className="drawer-content home-drawer"><div className="drawer-handle" /><div className="drawer-heading"><Drawer.Title className="drawer-title">{t("chooseYourDatesTitle")}</Drawer.Title><button className="drawer-close" type="button" aria-label="Close date picker" onClick={() => setDatesOpen(false)}><X size={18} /></button></div><p className="drawer-description">{t("pickupFirstBody")}</p><div className="date-choice-cards"><button className={`date-choice-card ${!startDate || endDate ? "active" : ""}`} type="button"><small>{t("pickupWord")}</small><strong>{readableDate(startDate)}</strong></button>{startDate && <button className={`date-choice-card ${!endDate ? "active" : ""}`} type="button"><small>{t("returnWord")}</small><strong>{readableDate(endDate)}</strong></button>}</div><CalendarPicker startDate={startDate} endDate={endDate} onChange={(nextStart, nextEnd) => { setStartDate(nextStart); setEndDate(nextEnd); setDateError(""); }} />{dateError && <p className="workflow-error">{dateError}</p>}<button className="workflow-submit coral" type="button" onClick={applyDates}><Check size={17} /> {t("applyDatesButton")}</button></Drawer.Content></Drawer.Portal></Drawer.Root>
    <Drawer.Root open={vehicleOpen} onOpenChange={setVehicleOpen}><Drawer.Trigger asChild><button className="search-field" type="button"><CarFront size={18} /><span><small>{t("vehicleTypeLabel")}</small><strong>{vehicleType}</strong></span><ChevronDown size={16} /></button></Drawer.Trigger><Drawer.Portal><Drawer.Overlay className="drawer-overlay" /><Drawer.Content className="drawer-content home-drawer"><div className="drawer-handle" /><div className="drawer-heading"><Drawer.Title className="drawer-title">{t("chooseAVehicleTitle")}</Drawer.Title><button className="drawer-close" type="button" aria-label="Close vehicle picker" onClick={() => setVehicleOpen(false)}><X size={18} /></button></div><div className="drawer-options">{vehicleTypes.map((option) => <button className="select-option" type="button" key={option} onClick={() => { setVehicleType(option); setVehicleOpen(false); }}>{option}{vehicleType === option && <Check size={18} />}</button>)}</div></Drawer.Content></Drawer.Portal></Drawer.Root>
    <button className="search-button" type="button" aria-label="Search for vehicles" onClick={search}><Search size={21} /></button>
  </div>;
}
