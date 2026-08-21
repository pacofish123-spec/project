"use client";

import { Check, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { SelectField } from "@/components/select-field";
import { useLanguage } from "@/lib/i18n";
import { useOutsideClose } from "@/lib/use-outside-close";

export interface SearchFilters {
  transmission: string;
  minPrice: string;
  maxPrice: string;
  seats: string;
}

interface FiltersButtonProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
}

// The vehicle-condition refinements (transmission, seats, price range) —
// separate from SearchPanel's location/dates/vehicle-type row, since
// those three mirror the homepage exactly and this one is /search-page-
// specific, real, working filtering rather than the decorative vehicle-
// type category picker.
export function FiltersButton({ filters, onFiltersChange }: FiltersButtonProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const [resetKey, setResetKey] = useState(0);
  const ref = useOutsideClose(open, () => setOpen(false));
  const activeCount = [filters.transmission, filters.minPrice, filters.maxPrice, filters.seats].filter(Boolean).length;

  function openPanel() {
    setDraft(filters);
    setResetKey((key) => key + 1);
    setOpen(true);
  }

  function apply() {
    setOpen(false);
    onFiltersChange(draft);
  }

  return (
    <div className="search-dropdown filters-dropdown" ref={ref}>
      <button className="results-search-filter" type="button" onClick={openPanel}><SlidersHorizontal size={17} /> {t("filters")}{activeCount > 0 ? ` (${activeCount})` : ""}</button>
      {open && (
        <div className="search-dropdown-panel">
          <div className="calendar-fields">
            <label>{t("minPriceLabel")}<input type="number" min="0" value={draft.minPrice} onChange={(event) => setDraft((current) => ({ ...current, minPrice: event.target.value }))} /></label>
            <label>{t("maxPriceLabel")}<input type="number" min="0" value={draft.maxPrice} onChange={(event) => setDraft((current) => ({ ...current, maxPrice: event.target.value }))} /></label>
          </div>
          <SelectField
            key={`transmission-${resetKey}`}
            name="transmission-filter"
            label={t("transmissionLabel")}
            defaultValue={draft.transmission || "any"}
            options={[{ value: "any", label: t("anyVehicleLabel") }, { value: "automatic", label: t("filterAutomatic") }, { value: "manual", label: "Manual" }]}
            onChange={(value) => setDraft((current) => ({ ...current, transmission: value === "any" ? "" : value }))}
          />
          <SelectField
            key={`seats-${resetKey}`}
            name="seats-filter"
            label={t("seatsLabel")}
            defaultValue={draft.seats || "any"}
            options={[{ value: "any", label: t("anyVehicleLabel") }, { value: "2", label: "2+" }, { value: "4", label: "4+" }, { value: "5", label: "5+" }, { value: "7", label: "7+" }]}
            onChange={(value) => setDraft((current) => ({ ...current, seats: value === "any" ? "" : value }))}
          />
          <button className="workflow-submit coral" type="button" onClick={apply}><Check size={17} /> {t("filters")}</button>
        </div>
      )}
    </div>
  );
}
