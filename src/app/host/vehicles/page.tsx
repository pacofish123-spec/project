"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, CarFront, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { SkeletonVehicleRows } from "@/components/skeleton";
import { useLanguage } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/translations";
import { formatMoney } from "@/lib/format";
import { vehiclePhotoUrl } from "@/lib/storage-url";

interface HostVehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  status: string;
  verification_status: string;
  daily_price: number;
  base_currency: string;
  promoted?: boolean;
  photo_paths?: string[] | null;
}

const vehicleStatusKey: Record<string, TranslationKey> = {
  draft: "vehicleStatusDraft",
  pending_review: "vehicleStatusPendingReview",
  published: "vehicleStatusPublished",
  paused: "vehicleStatusPaused",
  archived: "vehicleStatusArchived",
};

const verificationStatusKey: Record<string, TranslationKey> = {
  not_started: "verificationNotStarted",
  pending: "verificationPending",
  in_review: "verificationInReview",
  verified: "verificationVerified",
  failed: "verificationFailed",
  requires_information: "verificationRequiresInformation",
  expired: "verificationExpired",
};

export default function HostVehiclesPage() {
  const { t } = useLanguage();
  const [vehicles, setVehicles] = useState<HostVehicle[] | null>(null);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(() => {
    fetch("/api/host/dashboard").then(async (response) => {
      const result = await response.json() as { vehicles?: HostVehicle[]; error?: string };
      if (!response.ok) { setMessage(result.error ?? t("hostDashboardSignInPrompt")); return; }
      setVehicles(result.vehicles ?? []);
    }).catch(() => setMessage(t("hostDashboardLoadError")));
  }, [t]);

  useEffect(() => { load(); }, [load]);

  async function requestVerification(vehicleId: string) {
    setBusyId(vehicleId);
    setMessage("");
    const response = await fetch(`/api/vehicles/${vehicleId}/verification`, { method: "POST" });
    const result = await response.json().catch(() => ({})) as { error?: string };
    if (response.ok) load();
    else setMessage(result.error ?? t("hostCarsGenericError"));
    setBusyId("");
  }

  async function publishVehicle(vehicleId: string) {
    setBusyId(vehicleId);
    setMessage("");
    const response = await fetch(`/api/vehicles/${vehicleId}/publish`, { method: "POST" });
    const result = await response.json().catch(() => ({})) as { error?: string };
    if (response.ok) load();
    else setMessage(result.error ?? t("hostCarsGenericError"));
    setBusyId("");
  }

  async function archiveVehicle(vehicleId: string) {
    if (!window.confirm(t("archiveVehicleConfirm"))) return;
    setBusyId(vehicleId);
    setMessage("");
    const response = await fetch(`/api/vehicles/${vehicleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    const result = await response.json().catch(() => ({})) as { error?: string };
    if (response.ok) load();
    else setMessage(result.error ?? t("hostCarsGenericError"));
    setBusyId("");
  }

  async function deleteVehicle(vehicleId: string) {
    if (!window.confirm(t("deleteVehicleConfirm"))) return;
    setBusyId(vehicleId);
    setMessage("");
    const response = await fetch(`/api/vehicles/${vehicleId}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({})) as { error?: string };
    if (response.ok) { load(); }
    else { setMessage(result.error ?? t("deleteVehicleHistoryError")); }
    setBusyId("");
  }

  return (
    <>
      <AppHeader />
      <main className="workflow-page tint-wash-coral">
        <div className="page-width">
          <div className="workflow-nav"><Link className="workflow-back" href="/host/dashboard"><ArrowLeft size={16} /> {t("backLinkHostSetup")}</Link></div>
          <section className="dashboard-head">
            <div><p className="workflow-kicker">{t("hostDashboardMyVehicles")}</p><h1>{t("yourVehiclesHeading")}</h1><p>{t("hostVehiclesPageIntro")}</p></div>
            <Link className="workflow-submit coral" href="/host/cars/new"><Plus size={17} /> {t("hostDashboardAddVehicle")}</Link>
          </section>

          {message && <p className="workflow-error">{message}</p>}
          {vehicles === null && !message && <SkeletonVehicleRows />}
          {vehicles && vehicles.length === 0 && <p className="legal-note">{t("noVehiclesYet")}</p>}

          {vehicles && vehicles.length > 0 && (
            <div className="host-vehicle-list">
              {vehicles.map((vehicle) => {
                const photoUrl = vehicle.photo_paths?.[0] ? vehiclePhotoUrl(vehicle.photo_paths[0]) : null;
                return (
                  <article className="host-vehicle-row" key={vehicle.id}>
                    <div className={`host-vehicle-thumb ${photoUrl ? "" : "vehicle-image-placeholder"}`} style={photoUrl ? { backgroundImage: `url(${photoUrl})` } : undefined}>
                      {!photoUrl && <CarFront size={26} />}
                    </div>
                    <div className="host-vehicle-info">
                      <div>
                        <strong>{vehicle.make} {vehicle.model} {vehicle.year}</strong>
                        <span className={`trip-status trip-status-${vehicle.status}`}>{t(vehicleStatusKey[vehicle.status] ?? "vehicleStatusDraft")}</span>
                      </div>
                      <p><ShieldCheck size={13} /> {t(verificationStatusKey[vehicle.verification_status] ?? "verificationNotStarted")}<span className="host-vehicle-price">{formatMoney(vehicle.daily_price, vehicle.base_currency)} {t("perDaySuffix")}</span></p>
                      {vehicle.promoted && <p className="host-vehicle-promoted"><Sparkles size={13} /> {t("promotedVehicleNote")}</p>}
                    </div>
                    <div className="host-vehicle-actions">
                      <Link className="workflow-link" href={`/host/vehicles/${vehicle.id}/edit`}>{t("editVehicleAction")}</Link>
                      {vehicle.status !== "published" && vehicle.verification_status === "not_started" && (
                        <button className="workflow-link" type="button" disabled={busyId === vehicle.id} onClick={() => requestVerification(vehicle.id)}>
                          {busyId === vehicle.id ? t("requestingVerification") : t("requestVerificationAction")}
                        </button>
                      )}
                      {vehicle.status !== "published" && vehicle.verification_status === "verified" && (
                        <button className="workflow-link" type="button" disabled={busyId === vehicle.id} onClick={() => publishVehicle(vehicle.id)}>
                          {busyId === vehicle.id ? t("publishing") : t("publishAction")}
                        </button>
                      )}
                      {vehicle.status !== "archived" && (
                        <button className="workflow-link" type="button" disabled={busyId === vehicle.id} onClick={() => archiveVehicle(vehicle.id)}>
                          {busyId === vehicle.id ? t("archivingVehicle") : t("archiveVehicleAction")}
                        </button>
                      )}
                      <button className="workflow-link danger" type="button" disabled={busyId === vehicle.id} onClick={() => deleteVehicle(vehicle.id)}>
                        {busyId === vehicle.id ? t("deletingVehicle") : t("deleteVehicleAction")}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <p className="legal-note" style={{ marginTop: 30 }}><Link className="workflow-link" href="/host/extras">{t("myExtrasLink")}</Link> <ArrowRight size={12} style={{ verticalAlign: "-1px" }} /></p>
        </div>
      </main>
    </>
  );
}
