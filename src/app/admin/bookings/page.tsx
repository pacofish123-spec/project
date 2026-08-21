"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";
import { SkeletonCards } from "@/components/skeleton";
import { formatDate, formatMoney } from "@/lib/format";

interface AdminBooking {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  total: number;
  currency: string;
  created_at: string;
  renter_display_name: string;
  vehicles?: { make?: string; model?: string; year?: number; host_type?: string } | null;
}

const filters = ["all", "requested", "accepted", "in_progress", "disputed", "completed", "declined", "cancelled"] as const;

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<AdminBooking[] | null>(null);
  const [message, setMessage] = useState("Loading bookings...");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const [busyId, setBusyId] = useState("");

  function load() {
    fetch("/api/admin/bookings").then(async (response) => {
      const result = await response.json() as { bookings?: AdminBooking[]; error?: string };
      if (!response.ok) { setMessage(result.error ?? "Unable to load bookings."); setLoading(false); return; }
      setBookings(result.bookings ?? []);
      setMessage("");
      setLoading(false);
    }).catch(() => { setMessage("Unable to load bookings."); setLoading(false); });
  }

  useEffect(() => { load(); }, []);

  async function setStatus(id: string, status: string) {
    setBusyId(id);
    const response = await fetch(`/api/admin/bookings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (response.ok) load();
    setBusyId("");
  }

  const visible = useMemo(() => (bookings ?? []).filter((booking) => filter === "all" || booking.status === filter), [bookings, filter]);

  return (
    <section className="workflow-card wide requests-card">
      <p className="workflow-kicker">All bookings ({bookings?.length ?? 0})</p>
      <div className="admin-filters">
        {filters.map((option) => (
          <button key={option} className={filter === option ? "active" : ""} type="button" onClick={() => setFilter(option)}>{option.replace("_", " ")}</button>
        ))}
      </div>
      {loading && <SkeletonCards />}
      {!loading && message && <div className="dashboard-message"><CalendarClock size={22} /><p>{message}</p></div>}
      {bookings !== null && visible.length === 0 && <p className="admin-row-meta">No bookings match this filter.</p>}
      {visible.length > 0 && (
        <div className="trip-list">
          {visible.map((booking) => (
            <article className="trip-card" key={booking.id}>
              <div>
                <strong>{booking.vehicles ? `${booking.vehicles.make} ${booking.vehicles.model}` : "Vehicle"}</strong>
                <span className={`trip-status trip-status-${booking.status}`}>{booking.status.replace("_", " ")}</span>
              </div>
              <p className="admin-row-meta">{booking.renter_display_name} · {formatDate(booking.starts_at)} – {formatDate(booking.ends_at)}</p>
              <div className="trip-footer">
                <strong>{formatMoney(booking.total, booking.currency)}</strong>
                <div className="trip-actions">
                  {booking.status !== "disputed" && <button className="workflow-link" type="button" disabled={busyId === booking.id} onClick={() => setStatus(booking.id, "disputed")}>Flag disputed</button>}
                  {booking.status === "disputed" && <button className="workflow-link" type="button" disabled={busyId === booking.id} onClick={() => setStatus(booking.id, "completed")}>Resolve → completed</button>}
                  {booking.status === "disputed" && <button className="workflow-link" type="button" disabled={busyId === booking.id} onClick={() => setStatus(booking.id, "cancelled")}>Resolve → cancelled</button>}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
