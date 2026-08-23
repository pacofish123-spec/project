// The fixed 8-shot sequence (wedge 03) — shared between the guided
// capture UI (trips/[bookingId]/condition/page.tsx) and the API route
// that enforces completeness before a report is treated as "done".
export const CONDITION_REPORT_SHOT_KEYS = [
  "front",
  "back",
  "left",
  "right",
  "interior_front",
  "interior_rear",
  "odometer",
  "tyre_tread",
] as const;

export type ConditionReportShotKey = (typeof CONDITION_REPORT_SHOT_KEYS)[number];

export interface ConditionReportShot {
  path: string;
  capturedAt: string;
}
