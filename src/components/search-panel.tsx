"use client";

import { CalendarDays, CarFront, ChevronDown, Check, MapPin, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarPicker } from "@/components/calendar-picker";
import { useLanguage, localeByLanguage } from "@/lib/i18n";
import { useOutsideClose } from "@/lib/use-outside-close";
import { drDestinations } from "@/lib/destinations";

export interface SearchPanelValues {
  location: string;
  startDate: string;
  endDate: string;
  vehicleType: string;
}

interface SearchPanelProps {
  initialLocation?: string;
  initialStartDate?: string;
  initialEndDate?: string;
  initialVehicleType?: string;
  // Homepage usage (no onSearch) navigates to /search. The /search page
  // itself passes onSearch to update its own state in place instead —
  // this is the same panel either way, per the "make it look like the
  // main page" request.
  onSearch?: (values: SearchPanelValues) => void;
}

const destinationNames = drDestinations.map((destination) => destination.name);

export function SearchPanel({ initialLocation, initialStartDate = "", initialEndDate = "", initialVehicleType, onSearch }: SearchPanelProps) {
  const { t, language } = useLanguage();
  const vehicleTypes = [t("anyVehicleLabel"), t("vehicleTypeEconomy"), t("vehicleTypeSuv"), t("vehicleTypeLuxury"), t("vehicleTypeVan"), t("vehicleTypePickup")];
  const router = useRouter();
  const [locationOpen, setLocationOpen] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [location, setLocation] = useState(initialLocation || destinationNames[0]);
  const [locationQuery, setLocationQuery] = useState("");
  const [vehicleType, setVehicleType] = useState(initialVehicleType || vehicleTypes[0]);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [dateError, setDateError] = useState("");

  const locationRef = useOutsideClose(locationOpen, () => setLocationOpen(false));
  const datesRef = useOutsideClose(datesOpen, () => setDatesOpen(false));
  const vehicleRef = useOutsideClose(vehicleOpen, () => setVehicleOpen(false));

  function readableDate(value: string) {
    if (!value) return t("chooseDateFallback");
    return new Date(`${value}T12:00:00`).toLocaleDateString(localeByLanguage[language], { month: "short", day: "numeric" });
  }

  const dateSummary = startDate && endDate ? `${readableDate(startDate)} - ${readableDate(endDate)}` : startDate ? `${readableDate(startDate)} - ${t("returnDateWord")}` : t("addDatesLabel");
  const filteredLocations = destinationNames.filter((option) => option.toLowerCase().includes(locationQuery.toLowerCase()));

  function chooseLocation(option: string) {
    setLocation(option);
    setLocationQuery("");
    setLocationOpen(false);
    onSearch?.({ location: option, startDate, endDate, vehicleType });
  }

  function applyDates() {
    if (!startDate || !endDate) { setDateError(t("searchDatesRequiredError")); return; }
    setDateError(""); setDatesOpen(false);
    onSearch?.({ location, startDate, endDate, vehicleType });
  }

  function chooseVehicleType(option: string) {
    setVehicleType(option);
    setVehicleOpen(false);
    onSearch?.({ location, startDate, endDate, vehicleType: option });
  }

  function search() {
    if (onSearch) { onSearch({ location, startDate, endDate, vehicleType }); return; }
    const params = new URLSearchParams({ location, vehicleType });
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    router.push(`/search?${params.toString()}`);
  }

  return <div className="search-panel" aria-label="Search vehicles">
    <div className="search-dropdown" ref={locationRef}>
      <button className="search-field" type="button" onClick={() => setLocationOpen((value) => !value)}><MapPin size={18} /><span><small>{t("whereLabel")}</small><strong>{location}</strong></span><ChevronDown size={16} /></button>
      {locationOpen && (
        <div className="search-dropdown-panel">
          <input className="location-search" value={locationQuery} onChange={(event) => setLocationQuery(event.target.value)} placeholder={t("searchCountryPlaceholder")} aria-label="Search destinations" autoFocus />
          <div className="drawer-options">{filteredLocations.map((option, index) => <button className={`select-option ${index === 0 && !locationQuery ? "featured-location" : ""}`} type="button" key={option} onClick={() => chooseLocation(option)}>{index === 0 && !locationQuery && <MapPin size={17} />}{option}{location === option && <Check size={18} />}</button>)}</div>
        </div>
      )}
    </div>

    <div className="search-dropdown" ref={datesRef}>
      <button className="search-field" type="button" onClick={() => setDatesOpen((value) => !value)}><CalendarDays size={18} /><span><small>{t("pickupReturnLabel")}</small><strong>{dateSummary}</strong></span></button>
      {datesOpen && (
        <div className="search-dropdown-panel">
          <div className="date-choice-cards"><button className={`date-choice-card ${!startDate || endDate ? "active" : ""}`} type="button"><small>{t("pickupWord")}</small><strong>{readableDate(startDate)}</strong></button>{startDate && <button className={`date-choice-card ${!endDate ? "active" : ""}`} type="button"><small>{t("returnWord")}</small><strong>{readableDate(endDate)}</strong></button>}</div>
          <CalendarPicker startDate={startDate} endDate={endDate} onChange={(nextStart, nextEnd) => { setStartDate(nextStart); setEndDate(nextEnd); setDateError(""); }} />
          {dateError && <p className="workflow-error">{dateError}</p>}
          <button className="workflow-submit coral" type="button" onClick={applyDates}><Check size={17} /> {t("applyDatesButton")}</button>
        </div>
      )}
    </div>

    <div className="search-dropdown" ref={vehicleRef}>
      <button className="search-field" type="button" onClick={() => setVehicleOpen((value) => !value)}><CarFront size={18} /><span><small>{t("vehicleTypeLabel")}</small><strong>{vehicleType}</strong></span><ChevronDown size={16} /></button>
      {vehicleOpen && (
        <div className="search-dropdown-panel">
          <div className="drawer-options">{vehicleTypes.map((option) => <button className="select-option" type="button" key={option} onClick={() => chooseVehicleType(option)}>{option}{vehicleType === option && <Check size={18} />}</button>)}</div>
        </div>
      )}
    </div>

    <button className="search-button" type="button" aria-label="Search for vehicles" onClick={search}><Search size={21} /></button>
  </div>;
}
