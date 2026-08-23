"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

// Shared search input for every admin list tab (Users, Bookings,
// Disputes, Businesses, Vehicles, Payments) — same input styling
// (.location-search.user-search) the Users page already used before
// this existed. Filtering itself stays local to each page (a plain
// useMemo over whatever the list route already returned), this is only
// the input chrome.
export function AdminSearchBar({ value, onChange, placeholder, resultCount, totalCount }: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  resultCount: number;
  totalCount: number;
}) {
  return (
    <div className="admin-search-row">
      <input
        className="location-search user-search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {value && <p className="admin-row-meta">{resultCount} of {totalCount} match</p>}
    </div>
  );
}

// A small monospace, click-to-copy chip for a record's own id — dropped
// into every admin card (bookings, disputes, businesses, vehicles,
// payments, users) so a support agent can grab the exact id to search
// with elsewhere or hand to engineering.
export function AdminIdChip({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied in some contexts — the chip
      // still shows the id either way, copying is just a convenience.
    }
  }

  return (
    <button type="button" className="admin-id-chip" onClick={copy} title={id}>
      {copied ? <Check size={10} /> : <Copy size={10} />} {id.slice(0, 8)}
    </button>
  );
}
