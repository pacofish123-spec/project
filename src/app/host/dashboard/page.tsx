"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Building2, CalendarDays, CarFront, MessageCircle, Plus, ShieldCheck, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { formatDate, formatMoney } from "@/lib/format";
import { useLanguage, localeByLanguage } from "@/lib/i18n";

interface BookingRequest {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  total: number;
  platform_fee: number;
  currency: string;
  renter_display_name?: string;
  vehicles?: { make?: string; model?: string; year?: number } | null;
}

interface HostVehicle {
  id: string;
  status: string;
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

// A trip only counts toward earnings once it's past the "would this
// still fall through" stage — matches the exact same status filter and
// gross/platform_fee split the admin earnings view uses, so a host's
// number and the platform's own bookkeeping never quietly disagree.
const EARNING_STATUSES = new Set(["accepted", "in_progress", "completed"]);

export default function HostDashboardPage() {
  const { t, language } = useLanguage();
  const [data, setData] = useState<DashboardData | null>(null);
  const [message, setMessage] = useState(t("hostDashboardLoading"));
  const [busyId, setBusyId] = useState("");

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

  const [busyExtraKey, setBusyExtraKey] = useState("");
  async function respondToExtra(bookingId: string, extraId: string, status: "accepted" | "declined") {
    const key = `${bookingId}:${extraId}`;
    setBusyExtraKey(key);
    const response = await fetch(`/api/bookings/${bookingId}/extras/${extraId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (response.ok) load();
    setBusyExtraKey("");
  }

  const pendingRequests = (data?.requests ?? []).filter((request) => request.status === "requested");

  // Net payout (gross minus the platform's cut), grouped by currency —
  // a host's bookings are almost always one currency, but this stays
  // correct if they're not rather than silently mixing totals.
  const earningsByCurrency = new Map<string, number>();
  for (const request of data?.requests ?? []) {
    if (!EARNING_STATUSES.has(request.status)) continue;
    const net = (Number(request.total) || 0) - (Number(request.platform_fee) || 0);
    earningsByCurrency.set(request.currency, (earningsByCurrency.get(request.currency) ?? 0) + net);
  }
  const earningsLines = [...earningsByCurrency.entries()];

  return (
    <>
      <AppHeader />
      <main className="workflow-page tint-wash-coral">
        <div className="page-width">
        <div className="workflow-nav"><Link className="workflow-back" href="/host"><ArrowLeft size={16} /> {t("backLinkHostSetup")}</Link></div>
        <section className="dashboard-head">
          <div><p className="workflow-kicker">{t("hostDashboardKicker")}</p><h1>{t("hostDashboardTitleLine1")}<br /><em>{t("hostDashboardTitleLine2")}</em></h1><p>{t("hostDashboardIntro")}</p></div>
          <Link className="workflow-submit coral" href="/host/cars/new"><Plus size={17} /> {t("hostDashboardAddVehicle")}</Link>
        </section>

        {message && <div className="workflow-card dashboard-message"><ShieldCheck size={23} /><p>{message}</p><Link className="workflow-link" href="/sign-in">{t("signIn")} <ArrowRight size={14} /></Link></div>}

        <div className="dashboard-grid">
          <Link className="dashboard-tile" href="/host/vehicles"><CarFront size={22} /><strong>{t("hostDashboardMyVehicles")}</strong><span>{data ? t("hostDashboardVehiclesCount", { count: data.vehicles?.length ?? 0 }) : t("hostDashboardAddFirstVehicle")}</span></Link>
          <Link className="dashboard-tile" href="/trips"><CalendarDays size={22} /><strong>{t("hostDashboardBookingsRequests")}</strong><span>{data ? t("hostDashboardRequestsCount", { count: data.requests?.length ?? 0 }) : t("hostDashboardSignInToViewRequests")}</span></Link>
          <div className="dashboard-tile" style={{ cursor: "default" }}>
            <Wallet size={22} />
            <strong>{t("hostDashboardEarnings")}</strong>
            {earningsLines.length > 0
              ? <span>{earningsLines.map(([currency, amount]) => formatMoney(amount, currency)).join(" · ")}</span>
              : <span>{t("hostDashboardEarningsNone")}</span>}
          </div>
          <Link className="dashboard-tile" href="/host/business/new"><Building2 size={22} /><strong>{t("hostDashboardBusinesses")}</strong><span>{data ? t("hostDashboardBusinessMembershipsCount", { count: data.businesses?.length ?? 0 }) : t("hostDashboardCreateOrJoinBusiness")}</span></Link>
          <Link className="dashboard-tile" href="/trust"><MessageCircle size={22} /><strong>{t("hostDashboardTrustVerification")}</strong><span>{t("hostDashboardCompleteNextRequirement")}</span></Link>
        </div>

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
        </div>
      </main>
    </>
  );
}
