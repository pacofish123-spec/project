export interface AirportOption {
  code: string;
  name: string;
  city: string;
}

// Real international/regional airports, keyed by the IATA code already
// listed per-country in marketplace-config.ts's countries[].airports —
// add a code there too when adding one here, or it won't show up.
export const airportsByCountry: Record<string, AirportOption[]> = {
  DO: [
    { code: "SDQ", name: "Las Américas International Airport", city: "Santo Domingo" },
    { code: "PUJ", name: "Punta Cana International Airport", city: "Punta Cana" },
    { code: "STI", name: "Cibao International Airport", city: "Santiago" },
    { code: "POP", name: "Gregorio Luperón International Airport", city: "Puerto Plata" },
    { code: "AZS", name: "El Catey International Airport", city: "Samaná" },
    { code: "LRM", name: "La Romana International Airport", city: "La Romana" },
  ],
};
