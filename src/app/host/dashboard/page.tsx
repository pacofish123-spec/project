"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Building2, CalendarDays, CarFront, MessageCircle, Plus, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatDate, formatMoney } from "@/lib/format";
import { useLanguage, localeByLanguage } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { TranslationKey } from "@/lib/translations";

interface BookingRequest {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  total: number;
  currency: string;
  renter_display_name?: string;
  vehicles?: { make?: string; model?: string; year?: number } | null;
}

interface HostVehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  status: string;
  verification_status: string;
}

interface ExtraRequest {
  booking_id: string;
  extra_id: string;
  quantity: number;
  unit_price: number;
  extras?: { name?: string; currency?: string } | null;
  bookings?: { vehicles?: { make?: string; model?: string } | null } | null;
}

interface DashboardData {
  vehicles?: HostVehicle[];
  businesses?: Array<{ business_id: string; role: string; businesses?: { name?: string } | null }>;
  requests?: BookingRequest[];
  extraRequests?: ExtraRequest[];
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

export default function HostDashboardPage() {
  const { t, language } = useLanguage();
  const [data, setData] = useState<DashboardData | null>(null);
  const [message, setMessage] = useState(t("hostDashboardLoading"));
  const [busyId, setBusyId] = useState("");
  const [busyVehicleId, setBusyVehicleId] = useState("");

  const load = useCallback(() => {
    fetch("/api/host/dashboard").then(async (response) => {
      const result = await response.json() as DashboardData & { error?: string };
      if (!response.ok) setMessage(result.error ?? t("hostDashboardSignInPrompt"));
      else { setData(result); setMessage(""); }
    }).catch(() => setMessage(t("hostDashboardLoadError")));
  }, [t]);

  useEffect(() => { load(); }, [load]);

  async function respond(id: string, status: "accepted" | "declined") {
    setBusyId(id);
    const response = await fetch(`/api/bookings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (response.ok) load();
    setBusyId("");
  }

  async function requestVerification(vehicleId: string) {
    setBusyVehicleId(vehicleId);
    const response = await fetch(`/api/vehicles/${vehicleId}/verification`, { method: "POST" });
    if (response.ok) load();
    setBusyVehicleId("");
  }

  async function publishVehicle(vehicleId: string) {
    setBusyVehicleId(vehicleId);
    const response = await fetch(`/api/vehicles/${vehicleId}/publish`, { method: "POST" });
    if (response.ok) load();
    setBusyVehicleId("");
  }

  const [busyExtraKey, setBusyExtraKey] = useState("");
  async function respondToExtra(bookingId: string, extraId: string, status: "accepted" | "declined") {
    const key = `${bookingId}:${extraId}`;
    setBusyExtraKey(key);
    const response = await fetch(`/api/bookings/${bookingId}/extras/${extraId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (response.ok) load();
    setBusyExtraKey("");
  }

  const pendingRequests = (data?.requests ?? []).filter((request) => request.status === "requested");

  return (
    <main className="workflow-page">
      <div className="page-width">
        <div className="workflow-nav"><Link className="workflow-back" href="/host"><ArrowLeft size={16} /> {t("backLinkHostSetup")}</Link><ThemeToggle /></div>
        <section className="dashboard-head">
          <div><p className="workflow-kicker">{t("hostDashboardKicker")}</p><h1>{t("hostDashboardTitleLine1")}<br /><em>{t("hostDashboardTitleLine2")}</em></h1><p>{t("hostDashboardIntro")}</p></div>
          <Link className="workflow-submit coral" href="/host/cars/new"><Plus size={17} /> {t("hostDashboardAddVehicle")}</Link>
        </section>

        {message && <div className="workflow-card dashboard-message"><ShieldCheck size={23} /><p>{message}</p><Link className="workflow-link" href="/sign-in">{t("signIn")} <ArrowRight size={14} /></Link></div>}

        <div className="dashboard-grid">
          <Link className="dashboard-tile" href="/host/cars/new"><CarFront size={22} /><strong>{t("hostDashboardMyVehicles")}</strong><span>{data ? t("hostDashboardVehiclesCount", { count: data.vehicles?.length ?? 0 }) : t("hostDashboardAddFirstVehicle")}</span></Link>
          <Link className="dashboard-tile" href="/trips"><CalendarDays size={22} /><strong>{t("hostDashboardBookingsRequests")}</strong><span>{data ? t("hostDashboardRequestsCount", { count: data.requests?.length ?? 0 }) : t("hostDashboardSignInToViewRequests")}</span></Link>
          <Link className="dashboard-tile" href="/host/business/new"><Building2 size={22} /><strong>{t("hostDashboardBusinesses")}</strong><span>{data ? t("hostDashboardBusinessMembershipsCount", { count: data.businesses?.length ?? 0 }) : t("hostDashboardCreateOrJoinBusiness")}</span></Link>
          <Link className="dashboard-tile" href="/trust"><MessageCircle size={22} /><strong>{t("hostDashboardTrustVerification")}</strong><span>{t("hostDashboardCompleteNextRequirement")}</span></Link>
        </div>

        {data && data.vehicles && data.vehicles.length > 0 && (
          <section className="workflow-card wide requests-card">
            <div className="workflow-actions" style={{ marginTop: 0 }}>
              <p className="workflow-kicker" style={{ margin: 0 }}>{t("yourVehiclesHeading")}</p>
              <Link className="workflow-link" href="/host/extras">{t("myExtrasLink")} <ArrowRight size={14} /></Link>
            </div>
            <div className="trip-list">
              {data.vehicles.map((vehicle) => (
                <article className="trip-card" key={vehicle.id}>
                  <div>
                    <strong>{vehicle.make} {vehicle.model} {vehicle.year}</strong>
                    <span className={`trip-status trip-status-${vehicle.status}`}>{t(vehicleStatusKey[vehicle.status] ?? "vehicleStatusDraft")}</span>
                  </div>
                  <p><ShieldCheck size={14} /> {t(verificationStatusKey[vehicle.verification_status] ?? "verificationNotStarted")}</p>
                  {vehicle.status !== "published" && (
                    <div className="trip-footer">
                      {vehicle.verification_status === "not_started" && (
                        <button className="workflow-link" type="button" disabled={busyVehicleId === vehicle.id} onClick={() => requestVerification(vehicle.id)}>
                          {busyVehicleId === vehicle.id ? t("requestingVerification") : t("requestVerificationAction")}
                        </button>
                      )}
                      {vehicle.verification_status === "verified" && (
                        <button className="workflow-submit coral" type="button" disabled={busyVehicleId === vehicle.id} onClick={() => publishVehicle(vehicle.id)}>
                          {busyVehicleId === vehicle.id ? t("publishing") : t("publishAction")}
                        </button>
                      )}
                      {vehicle.verification_status !== "not_started" && vehicle.verification_status !== "verified" && (
                        <span className="trip-status">{t("publishNotVerifiedHint")}</span>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}
        {data && (!data.vehicles || data.vehicles.length === 0) && <p className="legal-note">{t("noVehiclesYet")}</p>}

        {pendingRequests.length > 0 && (
          <section className="workflow-card wide requests-card">
            <p className="workflow-kicker">{t("hostDashboardPendingRequests")}</p>
            <div className="trip-list">
              {pendingRequests.map((request) => (
                <article className="trip-card" key={request.id}>
                  <div>
                    <strong>{request.vehicles ? `${request.vehicles.make} ${request.vehicles.model}` : "Vehicle"}</strong>
                    <span className="trip-status">{request.renter_display_name}</span>
                  </div>
                  <p><CalendarDays size={14} /> {formatDate(request.starts_at, localeByLanguage[language])} &ndash; {formatDate(request.ends_at, localeByLanguage[language])}</p>
                  <div className="trip-footer">
                    <strong>{formatMoney(request.total, request.currency)}</strong>
                    <div className="trip-actions">
                      <Link className="workflow-link" href={`/messages/${request.id}`}>{t("messageLink")}</Link>
                      <button className="workflow-link" type="button" disabled={busyId === request.id} onClick={() => respond(request.id, "accepted")}>{t("hostDashboardAccept")}</button>
                      <button className="workflow-link" type="button" disabled={busyId === request.id} onClick={() => respond(request.id, "declined")}>{t("hostDashboardDecline")}</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {data && (data.extraRequests?.length ?? 0) > 0 && (
          <section className="workflow-card wide requests-card">
            <p className="workflow-kicker">{t("extraRequestsHeading")}</p>
            <div className="trip-list">
              {data!.extraRequests!.map((request) => {
                const key = `${request.booking_id}:${request.extra_id}`;
                return (
                  <article className="trip-card" key={key}>
                    <div>
                      <strong>{request.extras?.name ?? "Extra"} &times;{request.quantity}</strong>
                      <span className="trip-status">{request.bookings?.vehicles ? `${request.bookings.vehicles.make} ${request.bookings.vehicles.model}` : ""}</span>
                    </div>
                    <div className="trip-footer">
                      <strong>{formatMoney(request.unit_price * request.quantity, request.extras?.currency ?? "")}</strong>
                      <div className="trip-actions">
                        <button className="workflow-link" type="button" disabled={busyExtraKey === key} onClick={() => respondToExtra(request.booking_id, request.extra_id, "accepted")}>{t("hostDashboardAccept")}</button>
                        <button className="workflow-link" type="button" disabled={busyExtraKey === key} onClick={() => respondToExtra(request.booking_id, request.extra_id, "declined")}>{t("hostDashboardDecline")}</button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <p className="legal-note">{t("hostDashboardLegalNote")}</p>
        <div className="workflow-lang-bar"><LanguageSwitcher /></div>
      </div>
    </main>
  );
}
