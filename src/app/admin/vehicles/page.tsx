"use client";

import { useEffect, useMemo, useState } from "react";
import { CarFront } from "lucide-react";
import { SkeletonCards } from "@/components/skeleton";
import { formatMoney } from "@/lib/format";
import { AdminIdChip, AdminSearchBar } from "@/components/admin-search-bar";

interface AdminVehicle {
  id: string;
  owner_user_id: string;
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
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const [busyId, setBusyId] = useState("");
  const [query, setQuery] = useState("");

  function load() {
    fetch("/api/admin/vehicles").then(async (response) => {
      const result = await response.json() as { vehicles?: AdminVehicle[]; error?: string };
      if (!response.ok) { setMessage(result.error ?? "Unable to load vehicles."); setLoading(false); return; }
      setVehicles(result.vehicles ?? []);
      setMessage("");
      setLoading(false);
    }).catch(() => { setMessage("Unable to load vehicles."); setLoading(false); });
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

  const statusFiltered = useMemo(() => (vehicles ?? []).filter((vehicle) => filter === "all" || vehicle.status === filter), [vehicles, filter]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return statusFiltered;
    return statusFiltered.filter((vehicle) =>
      vehicle.id.toLowerCase().includes(needle)
      || vehicle.owner_user_id.toLowerCase().includes(needle)
      || vehicle.owner_display_name.toLowerCase().includes(needle)
      || vehicle.make.toLowerCase().includes(needle)
      || vehicle.model.toLowerCase().includes(needle));
  }, [statusFiltered, query]);

  return (
    <section className="workflow-card wide requests-card">
      <p className="workflow-kicker">All vehicles ({vehicles?.length ?? 0})</p>
      <AdminSearchBar value={query} onChange={setQuery} placeholder="Search by car id, owner name/id, make, or model…" resultCount={visible.length} totalCount={statusFiltered.length} />
      <div className="admin-filters">
        {filters.map((option) => (
          <button key={option} className={filter === option ? "active" : ""} type="button" onClick={() => setFilter(option)}>{option.replace("_", " ")}</button>
        ))}
      </div>
      {loading && <SkeletonCards />}
      {!loading && message && <div className="dashboard-message"><CarFront size={22} /><p>{message}</p></div>}
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
                {vehicle.host_type === "business" ? vehicle.businesses?.name ?? "Business" : vehicle.owner_display_name} · {vehicle.location_city}, {vehicle.country_code} · {formatMoney(vehicle.daily_price, vehicle.base_currency)}/day · <AdminIdChip id={vehicle.id} />
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
