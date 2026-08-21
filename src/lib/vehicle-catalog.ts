// Curated make → model list, focused on brands actually common in the
// Dominican Republic's car market (heavy on Japanese/Korean/American
// makes). Not exhaustive — hosts occasionally driving something outside
// this list can still get through via "Other" (see below) rather than
// being blocked entirely.
export const vehicleCatalog: Record<string, string[]> = {
  Toyota: ["Corolla", "Camry", "Yaris", "RAV4", "Highlander", "4Runner", "Land Cruiser", "Prado", "Hilux", "Tacoma", "Tundra", "Sienna", "Avanza", "Fortuner", "C-HR", "Prius"],
  Honda: ["Civic", "Accord", "CR-V", "HR-V", "Pilot", "Fit", "Odyssey", "Ridgeline"],
  Hyundai: ["Elantra", "Accent", "Sonata", "Tucson", "Santa Fe", "Kona", "Palisade", "Venue", "Creta", "i10", "i20"],
  Kia: ["Rio", "Forte", "Optima", "K5", "Sportage", "Sorento", "Soul", "Seltos", "Picanto", "Telluride"],
  Nissan: ["Sentra", "Altima", "Versa", "Frontier", "Kicks", "Rogue", "Pathfinder", "X-Trail", "Murano", "Titan", "Armada"],
  Chevrolet: ["Spark", "Sonic", "Cruze", "Malibu", "Aveo", "Onix", "Tracker", "Equinox", "Trailblazer", "Tahoe", "Suburban", "Silverado", "Colorado"],
  Ford: ["Fiesta", "Focus", "Fusion", "EcoSport", "Escape", "Explorer", "Edge", "Expedition", "Ranger", "F-150", "Bronco", "Mustang"],
  Jeep: ["Renegade", "Compass", "Cherokee", "Grand Cherokee", "Wrangler", "Patriot", "Gladiator"],
  Mitsubishi: ["Mirage", "Lancer", "ASX", "Outlander", "Montero", "L200", "Eclipse Cross"],
  Mazda: ["Mazda2", "Mazda3", "Mazda6", "CX-3", "CX-5", "CX-9", "BT-50"],
  Suzuki: ["Swift", "Baleno", "Vitara", "Jimny", "Ertiga", "S-Presso"],
  BMW: ["Serie 1", "Serie 2", "Serie 3", "Serie 5", "Serie 7", "X1", "X3", "X5", "X6"],
  "Mercedes-Benz": ["Clase A", "Clase C", "Clase E", "Clase S", "GLA", "GLC", "GLE", "GLS", "Sprinter"],
  Audi: ["A3", "A4", "A6", "Q3", "Q5", "Q7"],
  Volkswagen: ["Gol", "Jetta", "Golf", "Passat", "Tiguan", "Atlas", "Vento", "Polo", "Amarok"],
  Lexus: ["IS", "ES", "RX", "GX", "LX", "NX", "UX"],
  Subaru: ["Impreza", "Legacy", "Outback", "Forester", "XV", "Crosstrek"],
  Dodge: ["Charger", "Challenger", "Journey", "Durango", "Grand Caravan", "Attitude"],
  RAM: ["1500", "2500", "ProMaster"],
  GMC: ["Sierra", "Yukon", "Terrain", "Acadia"],
  Isuzu: ["D-Max", "MU-X", "Trooper"],
  Infiniti: ["Q50", "QX50", "QX60", "QX80"],
  Volvo: ["S60", "S90", "XC40", "XC60", "XC90"],
  "Land Rover": ["Discovery", "Discovery Sport", "Range Rover", "Range Rover Sport", "Range Rover Evoque", "Defender"],
  Jaguar: ["XE", "XF", "F-Pace", "E-Pace"],
  MINI: ["Cooper", "Countryman", "Clubman"],
  Fiat: ["Uno", "Palio", "500", "Mobi", "Argo", "Cronos"],
  Peugeot: ["208", "301", "2008", "3008", "5008"],
  Renault: ["Logan", "Sandero", "Duster", "Kwid", "Koleos"],
  Chrysler: ["300", "Pacifica", "Voyager"],
  Buick: ["Encore", "Envision", "Enclave"],
  Cadillac: ["ATS", "CTS", "XT4", "XT5", "Escalade"],
  Acura: ["ILX", "TLX", "RDX", "MDX"],
  Genesis: ["G70", "G80", "GV70", "GV80"],
  Porsche: ["911", "Cayenne", "Macan", "Panamera"],
  Tesla: ["Model 3", "Model S", "Model X", "Model Y"],
  Daihatsu: ["Terios", "Bego"],
  MG: ["MG5", "ZS", "HS", "RX5"],
  BYD: ["Song", "Yuan", "Han", "Tang"],
  Other: [],
};

export const vehicleMakes = Object.keys(vehicleCatalog);

export function modelsForMake(make: string): string[] {
  return vehicleCatalog[make] ?? [];
}

export function vehicleYears(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let year = currentYear + 1; year >= 1990; year -= 1) years.push(year);
  return years;
}
