"use client";

import { CalendarDays, CarFront, Check, MapPin, SlidersHorizontal, X } from "lucide-react";
import { Drawer } from "vaul";
import { useState } from "react";
import { CalendarPicker } from "@/components/calendar-picker";
import { SelectField } from "@/components/select-field";
import { useLanguage } from "@/lib/i18n";

export interface SearchFilters {
  transmission: string;
  minPrice: string;
  maxPrice: string;
  seats: string;
}

interface SearchControlsProps {
  destination: string;
  startDate: string;
  endDate: string;
  onDatesChange: (startDate: string, endDate: string) => void;
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
}

export function SearchControls({ destination, startDate, endDate, onDatesChange, filters, onFiltersChange }: SearchControlsProps) {
  const { t } = useLanguage();
  const [datesOpen, setDatesOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(startDate);
  const [draftEnd, setDraftEnd] = useState(endDate);
  const [dateError, setDateError] = useState("");
  const [draftFilters, setDraftFilters] = useState(filters);
  const [filterResetKey, setFilterResetKey] = useState(0);

  const dateSummary = startDate && endDate ? `${startDate} - ${endDate}` : startDate ? `${startDate} - ${t("addReturnDateWord")}` : t("addDatesLabel");
  const activeFilterCount = [filters.transmission, filters.minPrice, filters.maxPrice, filters.seats].filter(Boolean).length;

  function applyDates() {
    if (!draftStart || !draftEnd) { setDateError(t("searchDatesRequiredError")); return; }
    if (draftEnd < draftStart) { setDateError(t("searchReturnAfterPickupError")); return; }
    setDateError("");
    setDatesOpen(false);
    onDatesChange(draftStart, draftEnd);
  }

  function applyFilters() {
    setFiltersOpen(false);
    onFiltersChange(draftFilters);
  }

  return (
    <div className="results-search">
      <button className="results-search-control" type="button"><MapPin size={17} /><span>{destination}</span></button>

      <Drawer.Root open={datesOpen} onOpenChange={(next) => { setDatesOpen(next); if (next) { setDraftStart(startDate); setDraftEnd(endDate); } }}>
        <Drawer.Trigger asChild><button className="results-search-control" type="button"><CalendarDays size={17} /><span>{dateSummary}</span></button></Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Overlay className="drawer-overlay" />
          <Drawer.Content className="drawer-content calendar-drawer">
            <div className="drawer-handle" />
            <div className="drawer-heading"><Drawer.Title className="drawer-title">{t("chooseYourDatesTitle")}</Drawer.Title><button className="drawer-close" type="button" aria-label="Close date picker" onClick={() => setDatesOpen(false)}><X size={18} /></button></div>
            <p className="drawer-description">{t("tapPickupThenReturn")}</p>
            <CalendarPicker startDate={draftStart} endDate={draftEnd} onChange={(nextStart, nextEnd) => { setDraftStart(nextStart); setDraftEnd(nextEnd); setDateError(""); }} />
            {dateError && <p className="workflow-error">{dateError}</p>}
            <button className="workflow-submit coral" type="button" onClick={applyDates}><Check size={17} /> {t("applyDatesButton")}</button>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      <button className="results-search-control" type="button" onClick={() => { setDraftFilters(filters); setFiltersOpen(true); }}><CarFront size={17} /><span>{filters.transmission ? filters.transmission : t("anyVehicleLabel")}</span></button>

      <Drawer.Root open={filtersOpen} onOpenChange={(next) => { setFiltersOpen(next); if (next) { setDraftFilters(filters); setFilterResetKey((key) => key + 1); } }}>
        <Drawer.Trigger asChild>
          <button className="results-search-filter" type="button"><SlidersHorizontal size={17} /> {t("filters")}{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}</button>
        </Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Overlay className="drawer-overlay" />
          <Drawer.Content className="drawer-content calendar-drawer">
            <div className="drawer-handle" />
            <div className="drawer-heading"><Drawer.Title className="drawer-title">{t("filters")}</Drawer.Title><button className="drawer-close" type="button" aria-label="Close filters" onClick={() => setFiltersOpen(false)}><X size={18} /></button></div>
            <div className="calendar-fields">
              <label>{t("minPriceLabel")}<input type="number" min="0" value={draftFilters.minPrice} onChange={(event) => setDraftFilters((current) => ({ ...current, minPrice: event.target.value }))} /></label>
              <label>{t("maxPriceLabel")}<input type="number" min="0" value={draftFilters.maxPrice} onChange={(event) => setDraftFilters((current) => ({ ...current, maxPrice: event.target.value }))} /></label>
            </div>
            <SelectField
              key={`transmission-${filterResetKey}`}
              name="transmission-filter"
              label={t("transmissionLabel")}
              defaultValue={draftFilters.transmission || "any"}
              options={[{ value: "any", label: t("anyVehicleLabel") }, { value: "automatic", label: t("filterAutomatic") }, { value: "manual", label: "Manual" }]}
              onChange={(value) => setDraftFilters((current) => ({ ...current, transmission: value === "any" ? "" : value }))}
            />
            <SelectField
              key={`seats-${filterResetKey}`}
              name="seats-filter"
              label={t("seatsLabel")}
              defaultValue={draftFilters.seats || "any"}
              options={[{ value: "any", label: t("anyVehicleLabel") }, { value: "2", label: "2+" }, { value: "4", label: "4+" }, { value: "5", label: "5+" }, { value: "7", label: "7+" }]}
              onChange={(value) => setDraftFilters((current) => ({ ...current, seats: value === "any" ? "" : value }))}
            />
            <button className="workflow-submit coral" type="button" onClick={applyFilters}><Check size={17} /> {t("filters")}</button>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}
