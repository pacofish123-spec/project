// Route-based vehicle/toll/drive-time guidance (wedge 08) — "tell the
// renter what car they actually need" is the most credible trust
// signal available, and it directly undercuts the agency upsell of
// pushing a 4x4 for a trip that doesn't need one.
//
// Deliberately covers only the destinations where the route/road facts
// are well-established (major highways, known toll plazas) rather than
// guessing at all 31 curated cities — a wrong "any car is fine" on an
// unpaved mountain road is worse than no guidance at all. Every entry
// is framed as an estimate; road and toll conditions change.
export interface DestinationGuidance {
  vehicleAdvice: string;
  tollNote: string;
  driveTimeNote: string;
}

export const destinationGuidance: Record<string, DestinationGuidance> = {
  "santo domingo": {
    vehicleAdvice: "Any car — city driving on paved roads throughout.",
    tollNote: "A few small tolls on the Autopistas surrounding the city; cash is the reliable option at most booths.",
    driveTimeNote: "Capital city — no long approach drive.",
  },
  "punta cana": {
    vehicleAdvice: "Any car — the Coral Highway (Autovía del Coral) from Santo Domingo is a modern divided toll road the whole way.",
    tollNote: "Tolls apply along the Coral Highway; budget roughly RD$400–600 each way and keep small bills or a Paso Rápido tag handy.",
    driveTimeNote: "About 2.5–3h from Santo Domingo, traffic depending.",
  },
  "bávaro": {
    vehicleAdvice: "Any car — same Coral Highway approach as Punta Cana, a few minutes further.",
    tollNote: "Same toll structure as the Punta Cana approach.",
    driveTimeNote: "About 2.5–3h from Santo Domingo.",
  },
  "samaná": {
    vehicleAdvice: "Any car — reached via a toll highway, not the winding coastal road of years past.",
    tollNote: "Around RD$500 each way on the Samaná highway.",
    driveTimeNote: "Allow 3h from Santo Domingo — GPS estimates often run optimistic.",
  },
  "las terrenas": {
    vehicleAdvice: "Any car for the highway approach; the final stretch into town has some rougher patches worth driving slowly.",
    tollNote: "Same toll highway as the Samaná approach.",
    driveTimeNote: "Roughly 3–3.5h from Santo Domingo.",
  },
  "puerto plata": {
    vehicleAdvice: "Any car — the Autopista Duarte is a paved, divided highway the whole way.",
    tollNote: "A handful of tolls along the Duarte corridor; cash is the safer bet at most booths.",
    driveTimeNote: "About 3.5–4h from Santo Domingo.",
  },
  "santiago": {
    vehicleAdvice: "Any car — the Autopista Duarte again, the country's main west-bound highway.",
    tollNote: "Tolls along the Duarte corridor; cash preferred.",
    driveTimeNote: "About 2–2.5h from Santo Domingo.",
  },
  "la romana": {
    vehicleAdvice: "Any car — a paved highway route east from Santo Domingo.",
    tollNote: "Tolls apply on the eastbound autopista; cash is reliable.",
    driveTimeNote: "About 1.5–2h from Santo Domingo.",
  },
  "boca chica": {
    vehicleAdvice: "Any car — a short, easy highway hop from the capital.",
    tollNote: "One or two small tolls at most.",
    driveTimeNote: "Under 45 minutes from Santo Domingo.",
  },
  "sosúa": {
    vehicleAdvice: "Any car — same Duarte/north-coast highway approach as Puerto Plata.",
    tollNote: "Same toll structure as the Puerto Plata approach.",
    driveTimeNote: "About 3.5–4h from Santo Domingo.",
  },
  "cabarete": {
    vehicleAdvice: "Any car — a few minutes past Sosúa on the same coastal road.",
    tollNote: "Same toll structure as the Puerto Plata/Sosúa approach.",
    driveTimeNote: "About 4h from Santo Domingo.",
  },
  "jarabacoa": {
    vehicleAdvice: "This is one of the few places extra ground clearance genuinely helps — the Cordillera Central has steeper, sometimes unpaved stretches near the mountain attractions themselves (waterfalls, river crossings). A 4x4 or high-clearance vehicle is worth the upgrade here.",
    tollNote: "Tolls on the Duarte highway portion of the route; minimal beyond that.",
    driveTimeNote: "About 2.5h from Santo Domingo, more once off the main highway.",
  },
  "constanza": {
    vehicleAdvice: "Similar to Jarabacoa — mountain roads with real elevation change. Extra clearance is genuinely useful here, more so than most of the island.",
    tollNote: "Tolls on the highway portion; minimal on the mountain approach itself.",
    driveTimeNote: "3h+ from Santo Domingo — the mountain roads take longer than the distance suggests.",
  },
  "barahona": {
    vehicleAdvice: "Any car for the main highway; a higher-clearance vehicle is worth it only if venturing off the paved route toward the more remote coastline south of town.",
    tollNote: "Minimal tolls on this route compared to the east/north corridors.",
    driveTimeNote: "About 3h from Santo Domingo.",
  },
  "pedernales": {
    vehicleAdvice: "Any car, driven slowly, gets you there — Bahía de las Águilas itself is reached by boat from Las Cuevas, not by driving onto the beach.",
    tollNote: "Minimal tolls on this southwestern route.",
    driveTimeNote: "This is a long day — 4.5–5h from Santo Domingo. Plan accordingly.",
  },
};

export function findDestinationGuidance(name: string): DestinationGuidance | null {
  return destinationGuidance[name.trim().toLowerCase()] ?? null;
}
