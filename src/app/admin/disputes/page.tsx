"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { SkeletonCards } from "@/components/skeleton";
import { formatDate, formatMoney } from "@/lib/format";
import { AdminIdChip, AdminSearchBar } from "@/components/admin-search-bar";

interface ConditionReport {
  id: string;
  stage: "pickup" | "return";
  fuel_level: number | null;
  mileage: number | null;
  notes: string | null;
}

interface HeldDeposit {
  id: string;
  amount: number;
  currency: string;
  provider: string;
}

interface Dispute {
  id: string;
  vehicle_id: string;
  starts_at: string;
  ends_at: string;
  total: number;
  currency: string;
  updated_at: string;
  renter_user_id: string;
  renter_display_name: string;
  renter_date_of_birth: string | null;
  vehicles?: { make?: string; model?: string; year?: number } | null;
  condition_reports: ConditionReport[];
  held_deposit: HeldDeposit | null;
}

const CAPTURE_NOTICE_WINDOW_MS = 48 * 60 * 60 * 1000;

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[] | null>(null);
  const [message, setMessage] = useState("Loading disputes...");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [query, setQuery] = useState("");

  function load() {
    fetch("/api/admin/disputes").then(async (response) => {
      const result = await response.json() as { disputes?: Dispute[]; error?: string };
      if (!response.ok) { setMessage(result.error ?? "Unable to load disputes."); setLoading(false); return; }
      setDisputes(result.disputes ?? []);
      setMessage("");
      setLoading(false);
    }).catch(() => { setMessage("Unable to load disputes."); setLoading(false); });
  }

  useEffect(() => { load(); }, []);

  async function resolve(id: string, status: "completed" | "cancelled") {
    setBusyId(id);
    const response = await fetch(`/api/admin/bookings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (response.ok) load();
    setBusyId("");
  }

  async function captureDeposit(id: string) {
    if (!window.confirm("Capture this renter's held deposit? This charges their card/PayPal — only do this after reviewing the claim.")) return;
    setBusyId(id);
    const response = await fetch(`/api/admin/disputes/${id}/capture-deposit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const result = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) setMessage(result.error ?? "Unable to capture the deposit.");
    else load();
    setBusyId("");
  }

  const visible = useMemo(() => {
    if (!disputes) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return disputes;
    return disputes.filter((dispute) =>
      dispute.id.toLowerCase().includes(needle)
      || dispute.vehicle_id.toLowerCase().includes(needle)
      || dispute.renter_user_id.toLowerCase().includes(needle)
      || dispute.renter_display_name.toLowerCase().includes(needle)
      || (dispute.renter_date_of_birth ?? "").includes(needle)
      || (dispute.vehicles?.make ?? "").toLowerCase().includes(needle)
      || (dispute.vehicles?.model ?? "").toLowerCase().includes(needle));
  }, [disputes, query]);

  return (
    <section className="workflow-card wide requests-card">
      <p className="workflow-kicker">Open disputes ({disputes?.length ?? 0})</p>
      <AdminSearchBar value={query} onChange={setQuery} placeholder="Search by dispute id, car id, renter name/id/DOB, or make/model…" resultCount={visible.length} totalCount={disputes?.length ?? 0} />
      {loading && <SkeletonCards />}
      {!loading && message && <div className="dashboard-message"><AlertTriangle size={22} /><p>{message}</p></div>}
      {disputes !== null && visible.length === 0 && <p className="admin-row-meta">No disputes match this search.</p>}
      {visible.length > 0 && (
        <div className="trip-list">
          {visible.map((dispute) => {
            const pickup = dispute.condition_reports.find((report) => report.stage === "pickup");
            const returnReport = dispute.condition_reports.find((report) => report.stage === "return");
            return (
              <article className="trip-card" key={dispute.id}>
                <div>
                  <strong>{dispute.vehicles ? `${dispute.vehicles.make} ${dispute.vehicles.model} ${dispute.vehicles.year ?? ""}` : "Vehicle"}</strong>
                  <span className="trip-status trip-status-disputed">disputed</span>
                </div>
                <p className="admin-row-meta">{dispute.renter_display_name} · {formatDate(dispute.starts_at)} – {formatDate(dispute.ends_at)} · flagged {formatDate(dispute.updated_at)} · <AdminIdChip id={dispute.id} /></p>
                <div className="admin-reasons">
                  <span>pickup: {pickup ? `${pickup.fuel_level ?? "—"}% fuel, ${pickup.mileage ?? "—"} mi${pickup.notes ? ` — "${pickup.notes}"` : ""}` : "not filed"}</span>
                  <span>return: {returnReport ? `${returnReport.fuel_level ?? "—"}% fuel, ${returnReport.mileage ?? "—"} mi${returnReport.notes ? ` — "${returnReport.notes}"` : ""}` : "not filed"}</span>
                </div>
                {dispute.held_deposit && (
                  <p className="admin-row-meta">
                    held deposit: {formatMoney(dispute.held_deposit.amount, dispute.held_deposit.currency)} via {dispute.held_deposit.provider}
                    {Date.now() - new Date(dispute.updated_at).getTime() < CAPTURE_NOTICE_WINDOW_MS && " — capture unlocks after the 48h notice window"}
                  </p>
                )}
                <div className="trip-footer">
                  <strong>{formatMoney(dispute.total, dispute.currency)}</strong>
                  <div className="trip-actions">
                    {dispute.held_deposit && (
                      <button
                        className="workflow-link"
                        type="button"
                        disabled={busyId === dispute.id || Date.now() - new Date(dispute.updated_at).getTime() < CAPTURE_NOTICE_WINDOW_MS}
                        onClick={() => captureDeposit(dispute.id)}
                      >
                        Capture held deposit
                      </button>
                    )}
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
