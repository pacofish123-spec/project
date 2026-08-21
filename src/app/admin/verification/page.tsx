"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";
import { formatDate, formatMoney } from "@/lib/format";
import { vehiclePhotoUrl } from "@/lib/storage-url";

interface VerificationVehicle {
  make?: string;
  model?: string;
  year?: number;
  location_city?: string;
  country_code?: string;
  host_type?: string;
  description?: string | null;
  daily_price?: number;
  base_currency?: string;
  transmission?: string | null;
  seats?: number | null;
  has_ac?: boolean;
  fuel_policy?: string | null;
  cleaning_policy?: string | null;
  amenities?: string[] | null;
  photo_paths?: string[] | null;
}

interface VerificationRecord {
  id: string;
  status: string;
  verification_type: string;
  created_at: string;
  requester_display_name: string;
  vehicles?: VerificationVehicle | null;
}

const actionableStatuses = ["not_started", "pending", "in_review"];

// This page is admin-only chrome and doesn't otherwise touch the
// public i18n system (every other label on it is plain English too) —
// a local display-name map keeps it that way instead of pulling in
// useLanguage() just for this one list.
const amenityLabels: Record<string, string> = {
  bluetooth: "Bluetooth audio",
  backup_camera: "Backup camera",
  usb_charging: "USB charging",
  child_seat: "Child seat available",
  gps: "GPS navigation",
  sunroof: "Sunroof",
  heated_seats: "Heated seats",
  cruise_control: "Cruise control",
  keyless_entry: "Keyless entry",
  carplay: "Apple CarPlay / Android Auto",
  roof_rack: "Roof rack",
  dash_cam: "Dash cam",
};

function VehicleBreakdown({ vehicle }: { vehicle: VerificationVehicle }) {
  const photos = vehicle.photo_paths ?? [];
  return (
    <div className="admin-vehicle-breakdown">
      {photos.length > 0 ? (
        <div className="condition-photo-grid">
          {photos.map((path, index) => <a href={vehiclePhotoUrl(path)} target="_blank" rel="noreferrer" key={path}><img src={vehiclePhotoUrl(path)} alt={`${vehicle.make} ${vehicle.model} photo ${index + 1}`} /></a>)}
        </div>
      ) : (
        <p className="admin-row-meta">No photos uploaded yet.</p>
      )}
      {vehicle.description && <p className="admin-row-meta">{vehicle.description}</p>}
      <div className="admin-reasons">
        {vehicle.daily_price != null && <span>{formatMoney(vehicle.daily_price, vehicle.base_currency ?? "")}/day</span>}
        {vehicle.transmission && <span>{vehicle.transmission}</span>}
        {vehicle.seats != null && <span>{vehicle.seats} seats</span>}
        {vehicle.has_ac && <span>A/C</span>}
        {vehicle.fuel_policy && <span>Fuel: {vehicle.fuel_policy.replace("_", " ")}</span>}
        {vehicle.cleaning_policy && <span>Cleaning: {vehicle.cleaning_policy.replace(/_/g, " ")}</span>}
      </div>
      {vehicle.amenities && vehicle.amenities.length > 0 && (
        <div className="admin-reasons">
          {vehicle.amenities.map((value) => <span key={value}>{amenityLabels[value] ?? value}</span>)}
        </div>
      )}
    </div>
  );
}

export default function AdminVerificationPage() {
  const [records, setRecords] = useState<VerificationRecord[] | null>(null);
  const [message, setMessage] = useState("Loading verification queue...");
  const [busyId, setBusyId] = useState("");
  const [expandedId, setExpandedId] = useState("");

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
          {queue.map((record) => {
            const expanded = expandedId === record.id;
            return (
              <article className="trip-card" key={record.id}>
                <div>
                  <strong>{record.vehicles ? `${record.vehicles.make} ${record.vehicles.model} ${record.vehicles.year ?? ""}` : record.verification_type}</strong>
                  <span className="trip-status">{record.status.replace("_", " ")}</span>
                </div>
                <p className="admin-row-meta">Requested by {record.requester_display_name} · {formatDate(record.created_at)} {record.vehicles?.location_city ? `· ${record.vehicles.location_city}` : ""}</p>
                {record.vehicles && (
                  <button className="workflow-link" type="button" onClick={() => setExpandedId(expanded ? "" : record.id)}>
                    {expanded ? <ChevronUp size={13} style={{ verticalAlign: "-2px" }} /> : <ChevronDown size={13} style={{ verticalAlign: "-2px" }} />} {expanded ? "Hide details" : "View photos & details"}
                  </button>
                )}
                {expanded && record.vehicles && <VehicleBreakdown vehicle={record.vehicles} />}
                <div className="trip-footer">
                  <span />
                  <div className="trip-actions">
                    <button className="workflow-link" type="button" disabled={busyId === record.id} onClick={() => review(record.id, "requires_information")}>Needs info</button>
                    <button className="workflow-link" type="button" disabled={busyId === record.id} onClick={() => review(record.id, "failed")}>Reject</button>
                    <button className="workflow-submit coral" type="button" disabled={busyId === record.id} onClick={() => review(record.id, "verified")}>{busyId === record.id ? "Saving..." : "Verify"}</button>
                  </div>
                </div>
              </article>
            );
          })}
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
