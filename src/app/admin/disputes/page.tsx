"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { formatDate, formatMoney } from "@/lib/format";

interface ConditionReport {
  id: string;
  stage: "pickup" | "return";
  fuel_level: number | null;
  mileage: number | null;
  notes: string | null;
}

interface Dispute {
  id: string;
  starts_at: string;
  ends_at: string;
  total: number;
  currency: string;
  updated_at: string;
  renter_display_name: string;
  vehicles?: { make?: string; model?: string; year?: number } | null;
  condition_reports: ConditionReport[];
}

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[] | null>(null);
  const [message, setMessage] = useState("Loading disputes...");
  const [busyId, setBusyId] = useState("");

  function load() {
    fetch("/api/admin/disputes").then(async (response) => {
      const result = await response.json() as { disputes?: Dispute[]; error?: string };
      if (!response.ok) { setMessage(result.error ?? "Unable to load disputes."); return; }
      setDisputes(result.disputes ?? []);
      setMessage("");
    }).catch(() => setMessage("Unable to load disputes."));
  }

  useEffect(() => { load(); }, []);

  async function resolve(id: string, status: "completed" | "cancelled") {
    setBusyId(id);
    const response = await fetch(`/api/admin/bookings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (response.ok) load();
    setBusyId("");
  }

  return (
    <section className="workflow-card wide requests-card">
      <p className="workflow-kicker">Open disputes ({disputes?.length ?? 0})</p>
      {message && <div className="dashboard-message"><AlertTriangle size={22} /><p>{message}</p></div>}
      {disputes !== null && disputes.length === 0 && <p className="admin-row-meta">No open disputes right now.</p>}
      {disputes && disputes.length > 0 && (
        <div className="trip-list">
          {disputes.map((dispute) => {
            const pickup = dispute.condition_reports.find((report) => report.stage === "pickup");
            const returnReport = dispute.condition_reports.find((report) => report.stage === "return");
            return (
              <article className="trip-card" key={dispute.id}>
                <div>
                  <strong>{dispute.vehicles ? `${dispute.vehicles.make} ${dispute.vehicles.model} ${dispute.vehicles.year ?? ""}` : "Vehicle"}</strong>
                  <span className="trip-status trip-status-disputed">disputed</span>
                </div>
                <p className="admin-row-meta">{dispute.renter_display_name} · {formatDate(dispute.starts_at)} – {formatDate(dispute.ends_at)} · flagged {formatDate(dispute.updated_at)}</p>
                <div className="admin-reasons">
                  <span>pickup: {pickup ? `${pickup.fuel_level ?? "—"}% fuel, ${pickup.mileage ?? "—"} mi${pickup.notes ? ` — "${pickup.notes}"` : ""}` : "not filed"}</span>
                  <span>return: {returnReport ? `${returnReport.fuel_level ?? "—"}% fuel, ${returnReport.mileage ?? "—"} mi${returnReport.notes ? ` — "${returnReport.notes}"` : ""}` : "not filed"}</span>
                </div>
                <div className="trip-footer">
                  <strong>{formatMoney(dispute.total, dispute.currency)}</strong>
                  <div className="trip-actions">
                    <button className="workflow-link" type="button" disabled={busyId === dispute.id} onClick={() => resolve(dispute.id, "completed")}>Resolve → completed</button>
                    <button className="workflow-link" type="button" disabled={busyId === dispute.id} onClick={() => resolve(dispute.id, "cancelled")}>Resolve → cancelled</button>
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
