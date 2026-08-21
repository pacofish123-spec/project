"use client";

import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { SkeletonCards } from "@/components/skeleton";
import { formatDate, formatMoney } from "@/lib/format";

interface PaymentRecord {
  id: string;
  booking_id: string;
  provider: string;
  kind: "charge" | "refund" | "payout";
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  payer_display_name: string;
  payee_display_name: string;
  bookings?: { id: string; status: string; vehicles?: { make?: string; model?: string; year?: number } | null } | null;
}

export default function AdminPaymentsPage() {
  const [records, setRecords] = useState<PaymentRecord[] | null>(null);
  const [message, setMessage] = useState("Loading payments...");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  function load() {
    fetch("/api/admin/payments").then(async (response) => {
      const result = await response.json() as { records?: PaymentRecord[]; error?: string };
      if (!response.ok) { setMessage(result.error ?? "Unable to load payments."); setLoading(false); return; }
      setRecords(result.records ?? []);
      setMessage("");
      setLoading(false);
    }).catch(() => { setMessage("Unable to load payments."); setLoading(false); });
  }

  useEffect(() => { load(); }, []);

  async function refund(id: string) {
    setBusyId(id);
    const response = await fetch(`/api/admin/payments/${id}/refund`, { method: "POST" });
    const result = await response.json().catch(() => ({})) as { error?: string };
    if (response.ok) load();
    else setMessage(result.error ?? "Unable to process refund.");
    setBusyId("");
  }

  async function payout(bookingId: string) {
    setBusyId(bookingId);
    const response = await fetch("/api/admin/payments/payout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId }) });
    const result = await response.json().catch(() => ({})) as { error?: string };
    if (response.ok) load();
    else setMessage(result.error ?? "Unable to send payout.");
    setBusyId("");
  }

  const paidOutBookingIds = new Set((records ?? []).filter((record) => record.kind === "payout" && record.status === "paid").map((record) => record.booking_id));

  return (
    <section className="workflow-card wide requests-card">
      <p className="workflow-kicker">Payments</p>
      <p className="workflow-intro">Every charge, refund, and host payout that has moved real money, across every connected processor.</p>
      {loading && <SkeletonCards />}
      {!loading && message && <div className="dashboard-message"><Wallet size={22} /><p>{message}</p></div>}
      {records !== null && records.length === 0 && <p className="admin-row-meta">No payments recorded yet.</p>}

      {records && records.length > 0 && (
        <div className="trip-list">
          {records.map((record) => {
            const vehicle = record.bookings?.vehicles;
            const canRefund = record.kind === "charge" && record.status === "paid";
            const canPayout = record.kind === "charge" && record.status === "paid" && record.bookings?.status === "completed" && !paidOutBookingIds.has(record.booking_id);
            return (
              <article className="trip-card" key={record.id}>
                <div>
                  <strong>{vehicle ? `${vehicle.make} ${vehicle.model} ${vehicle.year ?? ""}` : "Booking"} — {record.kind}</strong>
                  <span className={`trip-status ${record.status === "paid" ? "trip-status-accepted" : record.status === "failed" ? "trip-status-declined" : ""}`}>{record.status}</span>
                </div>
                <p className="admin-row-meta">
                  {record.kind === "payout" ? `To ${record.payee_display_name}` : `From ${record.payer_display_name}`} · {record.provider} · {formatDate(record.created_at)}
                </p>
                <div className="trip-footer">
                  <strong>{formatMoney(record.amount, record.currency)}</strong>
                  <div className="trip-actions">
                    {canRefund && <button className="workflow-link" type="button" disabled={busyId === record.id} onClick={() => refund(record.id)}>{busyId === record.id ? "Refunding..." : "Refund"}</button>}
                    {canPayout && <button className="workflow-submit coral" type="button" disabled={busyId === record.booking_id} onClick={() => payout(record.booking_id)}>{busyId === record.booking_id ? "Paying..." : "Pay host"}</button>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
