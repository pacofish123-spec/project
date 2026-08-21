import type { TranslationKey } from "@/lib/translations";

// Shared between the "list your car" form (what a host flags they're
// open to) and the browse filters (what a renter can search for) —
// one source of truth for the value stored in vehicles.rental_terms.
export const rentalTermOptions: Array<{ value: string; labelKey: TranslationKey }> = [
  { value: "daily", labelKey: "rentalTermDaily" },
  { value: "weekend", labelKey: "rentalTermWeekend" },
  { value: "weekly", labelKey: "rentalTermWeekly" },
  { value: "monthly", labelKey: "rentalTermMonthly" },
  { value: "long_term", labelKey: "rentalTermLongTerm" },
];
