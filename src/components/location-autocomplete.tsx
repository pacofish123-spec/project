"use client";

import { MapPin, Plane } from "lucide-react";
import { useState } from "react";
import { useOutsideClose } from "@/lib/use-outside-close";
import { airportsByCountry } from "@/lib/dr-airports";
import { drDestinations } from "@/lib/destinations";
import { useLanguage } from "@/lib/i18n";

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  countryCode: string;
  placeholder?: string;
  required?: boolean;
}

// A free-text field (a real pickup spot can be a specific hotel or
// address, not just a city) that also suggests real airports and
// cities for the vehicle's own country as you type — clicking a
// suggestion fills the field, but nothing stops typing something else
// entirely.
export function LocationAutocomplete({ value, onChange, countryCode, placeholder, required }: LocationAutocompleteProps) {
  const { t } = useLanguage();
  const [focused, setFocused] = useState(false);
  const ref = useOutsideClose<HTMLDivElement>(focused, () => setFocused(false));

  const airports = airportsByCountry[countryCode] ?? [];
  const cities = countryCode === "DO" ? drDestinations.map((destination) => destination.name) : [];
  const query = value.trim().toLowerCase();
  const filteredAirports = query
    ? airports.filter((airport) => airport.name.toLowerCase().includes(query) || airport.code.toLowerCase().includes(query) || airport.city.toLowerCase().includes(query))
    : airports;
  const filteredCities = query ? cities.filter((city) => city.toLowerCase().includes(query)) : cities;
  const showPanel = focused && (filteredAirports.length > 0 || filteredCities.length > 0);

  return (
    <div className="location-autocomplete" ref={ref}>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
      />
      {showPanel && (
        <div className="location-autocomplete-panel">
          {filteredAirports.length > 0 && (
            <div className="location-autocomplete-group">
              <small>{t("locationSuggestAirports")}</small>
              {filteredAirports.map((airport) => (
                <button type="button" key={airport.code} onClick={() => { onChange(`${airport.name} (${airport.code})`); setFocused(false); }}>
                  <Plane size={14} />{airport.name} ({airport.code})
                </button>
              ))}
            </div>
          )}
          {filteredCities.length > 0 && (
            <div className="location-autocomplete-group">
              <small>{t("locationSuggestCities")}</small>
              {filteredCities.map((city) => (
                <button type="button" key={city} onClick={() => { onChange(city); setFocused(false); }}>
                  <MapPin size={14} />{city}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
