"use client";

import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { formatDate } from "@/lib/format";

interface Candidate {
  id: string;
  match_level: string;
  status: string;
  reasons: string[];
  created_at: string;
  canonical_display_name: string;
  candidate_display_name: string;
}

export default function AdminDuplicatesPage() {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [message, setMessage] = useState("Loading duplicate-account candidates...");
  const [busyId, setBusyId] = useState("");

  function load() {
    fetch("/api/admin/duplicates").then(async (response) => {
      const result = await response.json() as { candidates?: Candidate[]; error?: string };
      if (!response.ok) { setMessage(result.error ?? "Unable to load candidates."); return; }
      setCandidates(result.candidates ?? []);
      setMessage("");
    }).catch(() => setMessage("Unable to load candidates."));
  }

  useEffect(() => { load(); }, []);

  async function setStatus(id: string, status: string) {
    setBusyId(id);
    const response = await fetch(`/api/admin/duplicates/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (response.ok) load();
    setBusyId("");
  }

  return (
    <section className="workflow-card wide requests-card">
      <p className="workflow-kicker">Duplicate-account review ({candidates?.length ?? 0})</p>
      <p className="workflow-intro">Flagged automatically when a sign-up&apos;s verified email/phone, or a strong name-and-birth-date match, points at an account that already exists. Nothing here is merged automatically — accept, reject, or mark reviewed.</p>
      {message && <div className="dashboard-message"><Copy size={22} /><p>{message}</p></div>}
      {candidates !== null && candidates.length === 0 && <p className="admin-row-meta">No duplicate-account signals right now.</p>}
      {candidates && candidates.length > 0 && (
        <div className="trip-list">
          {candidates.map((candidate) => (
            <article className="trip-card" key={candidate.id}>
              <div>
                <strong>{candidate.candidate_display_name} &rarr; {candidate.canonical_display_name}</strong>
                <span className={`trip-status ${candidate.match_level === "CONFIRMED_MATCH" ? "trip-status-declined" : ""}`}>{candidate.match_level.replace("_", " ")}</span>
              </div>
              <p className="admin-row-meta">Flagged {formatDate(candidate.created_at)} · status: {candidate.status.replace("_", " ")}</p>
              <div className="admin-reasons">{(candidate.reasons ?? []).map((reason) => <span key={reason}>{reason.replace(/_/g, " ")}</span>)}</div>
              {(candidate.status === "flagged" || candidate.status === "under_review") && (
                <div className="trip-footer">
                  <span />
                  <div className="trip-actions">
                    <button className="workflow-link" type="button" disabled={busyId === candidate.id} onClick={() => setStatus(candidate.id, "under_review")}>Mark under review</button>
                    <button className="workflow-link" type="button" disabled={busyId === candidate.id} onClick={() => setStatus(candidate.id, "rejected")}>Not a duplicate</button>
                    <button className="workflow-submit coral" type="button" disabled={busyId === candidate.id} onClick={() => setStatus(candidate.id, "verified")}>{busyId === candidate.id ? "Saving..." : "Confirm duplicate"}</button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
