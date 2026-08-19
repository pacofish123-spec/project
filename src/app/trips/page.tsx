"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, CalendarDays, ClipboardList, Gauge, MapPin, MessageCircle } from "lucide-react";
import { formatDate, formatMoney } from "@/lib/format";
import { useLanguage, localeByLanguage } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { TranslationKey } from "@/lib/translations";

interface Booking {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  pickup_location: string;
  return_location: string;
  total: number;
  currency: string;
  vehicles?: { make: string; model: string; year: number; location_city: string; host_type: string } | null;
}

const statusKey: Record<string, TranslationKey> = {
  requested: "statusRequested",
  accepted: "statusAccepted",
  declined: "statusDeclined",
  cancelled: "statusCancelled",
  completed: "statusCompleted",
  in_progress: "statusInProgress",
  disputed: "statusDisputed",
};

const disputableStatuses = ["accepted", "in_progress", "completed"];

export default function TripsPage() {
  const { t, language } = useLanguage();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [message, setMessage] = useState(t("tripsLoading"));
  const [busyId, setBusyId] = useState("");
  const [disputingId, setDisputingId] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeBusy, setDisputeBusy] = useState(false);

  const load = useCallback(() => {
    fetch("/api/bookings").then(async (response) => {
      const result = await response.json() as { bookings?: Booking[]; error?: string };
      if (!response.ok) { setMessage(result.error ?? t("tripsSignInPrompt")); setBookings(null); return; }
      setBookings(result.bookings ?? []);
      setMessage("");
    }).catch(() => setMessage(t("tripsLoadError")));
  }, [t]);

  useEffect(() => { load(); }, [load]);

  async function cancelBooking(id: string) {
    setBusyId(id);
    const response = await fetch(`/api/bookings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }) });
    if (response.ok) load();
    setBusyId("");
  }

  async function submitDispute(id: string) {
    if (!disputeReason.trim()) return;
    setDisputeBusy(true);
    const response = await fetch(`/api/bookings/${id}/dispute`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: disputeReason }) });
    setDisputeBusy(false);
    if (response.ok) { setDisputingId(""); setDisputeReason(""); load(); }
  }

  return (
    <main className="workflow-page">
      <div className="page-width">
        <div className="workflow-nav"><Link className="workflow-back" href="/"><ArrowLeft size={16} /> {t("backLinkBrowse")}</Link>{!bookings && <Link className="workflow-link" href="/sign-in">{t("signIn")}</Link>}</div>
        <section className="workflow-card wide">
          <p className="workflow-kicker">{t("tripsKicker")}</p>
          <h1>{t("tripsTitleLine1")}<br /><em>{t("tripsTitleLine2")}</em></h1>

          {message && (
            <div className="dashboard-message">
              <ClipboardList size={22} />
              <p>{message}</p>
              {!bookings && <Link className="workflow-link" href="/sign-in">{t("signIn")} <ArrowRight size={14} /></Link>}
            </div>
          )}

          {bookings && bookings.length === 0 && (
            <div className="empty-results compact">
              <ClipboardList size={30} />
              <h2>{t("tripsEmptyTitle")}</h2>
              <p>{t("tripsEmptyBody")}</p>
              <Link className="workflow-link" href="/search">{t("navExploreCars")} <ArrowRight size={15} /></Link>
            </div>
          )}

          {bookings && bookings.length > 0 && (
            <div className="trip-list">
              {bookings.map((booking) => (
                <article className="trip-card" key={booking.id}>
                  <div>
                    <strong>{booking.vehicles ? `${booking.vehicles.make} ${booking.vehicles.model}` : "Vehicle"}</strong>
                    <span className={`trip-status trip-status-${booking.status}`}>{t(statusKey[booking.status] ?? "statusRequested")}</span>
                  </div>
                  <p><CalendarDays size={14} /> {formatDate(booking.starts_at, localeByLanguage[language])} &ndash; {formatDate(booking.ends_at, localeByLanguage[language])}</p>
                  <p><MapPin size={14} /> {booking.pickup_location} &rarr; {booking.return_location}</p>
                  <div className="trip-footer">
                    <strong>{formatMoney(booking.total, booking.currency)}</strong>
                    <div className="trip-actions">
                      <Link className="workflow-link" href={`/messages/${booking.id}`}><MessageCircle size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />{t("messageLink")}</Link>
                      {disputableStatuses.includes(booking.status) && (
                        <Link className="workflow-link" href={`/trips/${booking.id}/condition`}><Gauge size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />{t("conditionReportLink")}</Link>
                      )}
                      {disputableStatuses.includes(booking.status) && (
                        <button className="workflow-link" type="button" onClick={() => setDisputingId(disputingId === booking.id ? "" : booking.id)}>
                          <AlertTriangle size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />{t("reportAnIssue")}
                        </button>
                      )}
                      {(booking.status === "requested" || booking.status === "accepted") && (
                        <button className="workflow-link" type="button" disabled={busyId === booking.id} onClick={() => cancelBooking(booking.id)}>
                          {busyId === booking.id ? t("tripsCancelling") : t("tripsCancel")}
                        </button>
                      )}
                    </div>
                  </div>
                  {disputingId === booking.id && (
                    <div className="message-composer" style={{ marginTop: 4 }}>
                      <input value={disputeReason} onChange={(event) => setDisputeReason(event.target.value)} placeholder={t("disputeReasonPlaceholder")} />
                      <button className="workflow-submit coral" type="button" disabled={disputeBusy || !disputeReason.trim()} onClick={() => submitDispute(booking.id)}>{t("submitDispute")}</button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
          <div className="workflow-lang-bar"><LanguageSwitcher /></div>
        </section>
      </div>
    </main>
  );
}
