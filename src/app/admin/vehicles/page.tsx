"use client";

import { useEffect, useMemo, useState } from "react";
import { CarFront } from "lucide-react";
import { formatMoney } from "@/lib/format";

interface AdminVehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  status: string;
  host_type: string;
  daily_price: number;
  base_currency: string;
  location_city: string;
  country_code: string;
  owner_display_name: string;
  businesses?: { name: string } | null;
}

const filters = ["all", "draft", "pending_review", "published", "paused", "archived"] as const;
const nextStatusActions: Record<string, Array<{ label: string; status: string }>> = {
  draft: [{ label: "Publish", status: "published" }],
  pending_review: [{ label: "Publish", status: "published" }, { label: "Reject → paused", status: "paused" }],
  published: [{ label: "Pause", status: "paused" }, { label: "Archive", status: "archived" }],
  paused: [{ label: "Republish", status: "published" }, { label: "Archive", status: "archived" }],
  archived: [{ label: "Restore → draft", status: "draft" }],
};

export default function AdminVehiclesPage() {
  const [vehicles, setVehicles] = useState<AdminVehicle[] | null>(null);
  const [message, setMessage] = useState("Loading vehicles...");
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const [busyId, setBusyId] = useState("");

  function load() {
    fetch("/api/admin/vehicles").then(async (response) => {
      const result = await response.json() as { vehicles?: AdminVehicle[]; error?: string };
      if (!response.ok) { setMessage(result.error ?? "Unable to load vehicles."); return; }
      setVehicles(result.vehicles ?? []);
      setMessage("");
    }).catch(() => setMessage("Unable to load vehicles."));
  }

  useEffect(() => { load(); }, []);

  async function setStatus(id: string, status: string) {
    setBusyId(id);
    const response = await fetch(`/api/admin/vehicles/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (response.ok) load();
    setBusyId("");
  }

  async function deleteVehicle(id: string) {
    if (!window.confirm("Delete this vehicle? This can't be undone.")) return;
    setBusyId(id);
    const response = await fetch(`/api/admin/vehicles/${id}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({})) as { error?: string };
    if (response.ok) load();
    else setMessage(result.error ?? "This vehicle has booking or verification history and can't be deleted.");
    setBusyId("");
  }

  const visible = useMemo(() => (vehicles ?? []).filter((vehicle) => filter === "all" || vehicle.status === filter), [vehicles, filter]);

  return (
    <section className="workflow-card wide requests-card">
      <p className="workflow-kicker">All vehicles ({vehicles?.length ?? 0})</p>
      <div className="admin-filters">
        {filters.map((option) => (
          <button key={option} className={filter === option ? "active" : ""} type="button" onClick={() => setFilter(option)}>{option.replace("_", " ")}</button>
        ))}
      </div>
      {message && <div className="dashboard-message"><CarFront size={22} /><p>{message}</p></div>}
      {vehicles !== null && visible.length === 0 && <p className="admin-row-meta">No vehicles match this filter.</p>}
      {visible.length > 0 && (
        <div className="trip-list">
          {visible.map((vehicle) => (
            <article className="trip-card" key={vehicle.id}>
              <div>
                <strong>{vehicle.make} {vehicle.model} {vehicle.year}</strong>
                <span className={`trip-status trip-status-${vehicle.status}`}>{vehicle.status.replace("_", " ")}</span>
              </div>
              <p className="admin-row-meta">
                {vehicle.host_type === "business" ? vehicle.businesses?.name ?? "Business" : vehicle.owner_display_name} · {vehicle.location_city}, {vehicle.country_code} · {formatMoney(vehicle.daily_price, vehicle.base_currency)}/day
              </p>
              <div className="trip-footer">
                <div className="trip-actions">
                  {(nextStatusActions[vehicle.status] ?? []).map((action) => (
                    <button key={action.status} className="workflow-link" type="button" disabled={busyId === vehicle.id} onClick={() => setStatus(vehicle.id, action.status)}>{action.label}</button>
                  ))}
                  <button className="workflow-link danger" type="button" disabled={busyId === vehicle.id} onClick={() => deleteVehicle(vehicle.id)}>Delete</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
