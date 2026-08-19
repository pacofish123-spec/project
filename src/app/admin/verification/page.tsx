"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { formatDate } from "@/lib/format";

interface VerificationRecord {
  id: string;
  status: string;
  verification_type: string;
  created_at: string;
  requester_display_name: string;
  vehicles?: { make?: string; model?: string; year?: number; location_city?: string; host_type?: string } | null;
}

const actionableStatuses = ["not_started", "pending", "in_review"];

export default function AdminVerificationPage() {
  const [records, setRecords] = useState<VerificationRecord[] | null>(null);
  const [message, setMessage] = useState("Loading verification queue...");
  const [busyId, setBusyId] = useState("");

  function load() {
    fetch("/api/admin/verification").then(async (response) => {
      const result = await response.json() as { records?: VerificationRecord[]; error?: string };
      if (!response.ok) { setMessage(result.error ?? "Unable to load the verification queue."); return; }
      setRecords(result.records ?? []);
      setMessage("");
    }).catch(() => setMessage("Unable to load the verification queue."));
  }

  useEffect(() => { load(); }, []);

  async function review(id: string, status: "verified" | "failed" | "requires_information") {
    setBusyId(id);
    const response = await fetch(`/api/admin/verification/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (response.ok) load();
    setBusyId("");
  }

  const queue = (records ?? []).filter((record) => actionableStatuses.includes(record.status));
  const history = (records ?? []).filter((record) => !actionableStatuses.includes(record.status));

  return (
    <section className="workflow-card wide requests-card">
      <p className="workflow-kicker">Vehicle verification queue</p>
      <p className="workflow-intro">Vehicles land here after a host requests verification. Nothing publishes until you mark one verified.</p>
      {message && <div className="dashboard-message"><ShieldCheck size={22} /><p>{message}</p></div>}

      {records !== null && queue.length === 0 && <p className="admin-row-meta">Nothing waiting on review right now.</p>}

      {queue.length > 0 && (
        <div className="trip-list">
          {queue.map((record) => (
            <article className="trip-card" key={record.id}>
              <div>
                <strong>{record.vehicles ? `${record.vehicles.make} ${record.vehicles.model} ${record.vehicles.year ?? ""}` : record.verification_type}</strong>
                <span className="trip-status">{record.status.replace("_", " ")}</span>
              </div>
              <p className="admin-row-meta">Requested by {record.requester_display_name} · {formatDate(record.created_at)} {record.vehicles?.location_city ? `· ${record.vehicles.location_city}` : ""}</p>
              <div className="trip-footer">
                <span />
                <div className="trip-actions">
                  <button className="workflow-link" type="button" disabled={busyId === record.id} onClick={() => review(record.id, "requires_information")}>Needs info</button>
                  <button className="workflow-link" type="button" disabled={busyId === record.id} onClick={() => review(record.id, "failed")}>Reject</button>
                  <button className="workflow-submit coral" type="button" disabled={busyId === record.id} onClick={() => review(record.id, "verified")}>{busyId === record.id ? "Saving..." : "Verify"}</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <>
          <p className="workflow-kicker" style={{ marginTop: 28 }}>Reviewed</p>
          <div className="trip-list">
            {history.map((record) => (
              <article className="trip-card" key={record.id}>
                <div>
                  <strong>{record.vehicles ? `${record.vehicles.make} ${record.vehicles.model}` : record.verification_type}</strong>
                  <span className={`trip-status ${record.status === "verified" ? "trip-status-accepted" : record.status === "failed" ? "trip-status-declined" : ""}`}>{record.status.replace("_", " ")}</span>
                </div>
                <p className="admin-row-meta">Requested by {record.requester_display_name} · {formatDate(record.created_at)}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
