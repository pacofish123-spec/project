function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

// A blank "Add dates" field asks first-time visitors to make a decision
// before they've seen a single car. Default to a plausible near-term trip
// (tomorrow, three nights) — still fully editable, just no longer empty.
// Plain (non-"use client") module so both the search panel and any
// server component that needs to seed matching initial state (/search)
// can import it.
export function defaultDateRange() {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 3);
  return { start: toISODate(start), end: toISODate(end) };
}
