import type { CountryConfig } from "./domain";

export const supportedLanguages = ["es", "en", "fr"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

export const supportedCurrencies = ["DOP", "USD", "EUR", "CAD", "GBP", "MXN"] as const;
export type SupportedCurrency = (typeof supportedCurrencies)[number];

export const countries: CountryConfig[] = [
  {
    code: "DO",
    name: "Dominican Republic",
    currencies: ["DOP", "USD"],
    languages: ["es", "en", "fr"],
    timezone: "America/Santo_Domingo",
    measurementSystem: "metric",
    destinations: ["Santo Domingo", "Punta Cana", "Bávaro", "Samaná", "Las Terrenas", "Puerto Plata", "Santiago", "La Romana", "Boca Chica"],
    airports: ["SDQ", "PUJ", "STI", "POP"],
  },
  {
    code: "US",
    name: "United States",
    currencies: ["USD"],
    languages: ["en", "es", "fr"],
    timezone: "America/New_York",
    measurementSystem: "imperial",
    destinations: [],
    airports: [],
  },
  {
    code: "FR",
    name: "France",
    currencies: ["EUR"],
    languages: ["fr", "en", "es"],
    timezone: "Europe/Paris",
    measurementSystem: "metric",
    destinations: [],
    airports: [],
  },
];

export const translations = {
  en: {
    tagline: "Your next journey starts here.",
    search: "Search",
    listYourCar: "List your car",
    personalOwner: "Personal Owner",
    business: "Business",
  },
  es: {
    tagline: "Tu próximo viaje empieza aquí.",
    search: "Buscar",
    listYourCar: "Publica tu vehículo",
    personalOwner: "Propietario particular",
    business: "Empresa",
  },
  fr: {
    tagline: "Votre prochain voyage commence ici.",
    search: "Rechercher",
    listYourCar: "Publier votre véhicule",
    personalOwner: "Propriétaire particulier",
    business: "Entreprise",
  },
} as const;