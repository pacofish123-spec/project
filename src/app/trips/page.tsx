"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, CalendarDays, CarFront, CheckCircle2, ClipboardList, CreditCard, FileDown, Gauge, MapPin, MessageCircle } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { SkeletonCards } from "@/components/skeleton";
import { PublicProfilePopover } from "@/components/public-profile-popover";
import { ReviewPrompt } from "@/components/review-prompt";
import { PaymentProviderButton } from "@/components/payment-provider-button";
import { formatDate, formatMoney } from "@/lib/format";
import { useLanguage, localeByLanguage } from "@/lib/i18n";
import { vehiclePhotoUrl } from "@/lib/storage-url";
import type { TranslationKey } from "@/lib/translations";

interface RenterBooking {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  pickup_location: string;
  return_location: string;
  total: number;
  currency: string;
  vehicles?: { make: string; model: string; year: number; location_city: string; host_type: string; photo_paths?: string[] | null } | null;
  payment_records?: Array<{ status: string; kind: string; provider: string; amount: number; currency: string }> | null;
}

interface HostBooking {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  pickup_location: string;
  return_location: string;
  total: number;
  currency: string;
  renter_user_id: string;
  renter_display_name?: string;
  vehicles?: { make?: string; model?: string; year?: number; photo_paths?: string[] | null } | null;
  payment_records?: Array<{ status: string; kind: string; provider: string }> | null;
}

interface PaymentProviderOption { id: string; label: string }

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

function tripDateRange(startsAt: string, endsAt: string, locale: string) {
  const start = formatDate(startsAt, locale);
  const end = formatDate(endsAt, locale);
  const startTime = new Date(startsAt).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  const endTime = new Date(endsAt).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  return `${start}, ${startTime} – ${end}, ${endTime}`;
}

function TripThumb({ photoPaths }: { photoPaths?: string[] | null }) {
  const url = photoPaths?.[0] ? vehiclePhotoUrl(photoPaths[0]) : null;
  return <div className="trip-card-thumb" style={url ? { backgroundImage: `url(${url})` } : undefined}>{!url && <CarFront size={22} />}</div>;
}

export default function TripsPage() {
  const { t, language } = useLanguage();
  const locale = localeByLanguage[language];

  const [bookings, setBookings] = useState<RenterBooking[] | null>(null);
  const [message, setMessage] = useState(t("tripsLoading"));
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [disputingId, setDisputingId] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeBusy, setDisputeBusy] = useState(false);
  const [payProviders, setPayProviders] = useState<PaymentProviderOption[]>([]);
  const [payingId, setPayingId] = useState("");
  const [payChoiceId, setPayChoiceId] = useState("");
  const [paymentBanner, setPaymentBanner] = useState<"success" | "failed" | "">("");
  const [payError, setPayError] = useState("");

  // Deposit/waiver — the optional $300 refundable hold vs. the
  // (admin-gated, off by default) damage-waiver fee. depositChoiceId
  // tracks which booking card has the chooser open; depositMethod
  // tracks which of the two a renter picked, within that same card, so
  // the provider buttons underneath route to the right endpoint.
  const [depositChoiceId, setDepositChoiceId] = useState("");
  const [depositMethod, setDepositMethod] = useState<"deposit" | "waiver" | "">("");
  const [depositBusyId, setDepositBusyId] = useState("");
  const [depositError, setDepositError] = useState("");
  const [waiverSettings, setWaiverSettings] = useState<{ enabled: boolean; dailyRate: number | null; currency: string }>({ enabled: false, dailyRate: null, currency: "USD" });

  // "Cars booked from me" — only shown at all once we know the account
  // owns at least one vehicle; a pure renter never sees an empty host
  // section.
  const [hostBookings, setHostBookings] = useState<HostBooking[] | null>(null);
  const [hasVehicles, setHasVehicles] = useState(false);
  const [hostBusyId, setHostBusyId] = useState("");

  useEffect(() => {
    fetch("/api/payments/providers").then(async (response) => {
      const result = await response.json() as { providers?: PaymentProviderOption[] };
      if (response.ok) setPayProviders(result.providers ?? []);
    }).catch(() => {});
    fetch("/api/platform-settings").then(async (response) => {
      const result = await response.json() as { settings?: { insurance_waiver_enabled: boolean; insurance_waiver_daily_rate: number | null; insurance_waiver_currency: string } };
      if (response.ok && result.settings) {
        setWaiverSettings({ enabled: result.settings.insurance_waiver_enabled, dailyRate: result.settings.insurance_waiver_daily_rate, currency: result.settings.insurance_waiver_currency });
      }
    }).catch(() => {});
    // Deferred a tick (matches the same pattern admin/analytics uses)
    // so this isn't a bare synchronous setState in the effect body —
    // this state is only ever knowable client-side (query string),
    // so it has to be read post-mount either way; the server-rendered
    // and first client render both show no banner, avoiding a
    // hydration mismatch.
    queueMicrotask(() => {
      const params = new URLSearchParams(window.location.search);
      if (!params.has("paid")) return;
      setPaymentBanner(params.get("paid") === "1" ? "success" : "failed");
      window.history.replaceState(null, "", window.location.pathname);
    });
  }, []);

  const load = useCallback(() => {
    fetch("/api/bookings").then(async (response) => {
      const result = await response.json() as { bookings?: RenterBooking[]; error?: string };
      if (!response.ok) { setMessage(result.error ?? t("tripsSignInPrompt")); setBookings(null); setLoading(false); return; }
      setBookings(result.bookings ?? []);
      setMessage("");
      setLoading(false);
    }).catch(() => { setMessage(t("tripsLoadError")); setLoading(false); });
  }, [t]);

  const loadHost = useCallback(() => {
    fetch("/api/host/dashboard").then(async (response) => {
      const result = await response.json() as { requests?: HostBooking[]; vehicles?: unknown[] };
      if (!response.ok) return;
      setHostBookings(result.requests ?? []);
      setHasVehicles((result.vehicles?.length ?? 0) > 0);
    }).catch(() => {});
  }, []);

  useEffect(() => { load(); loadHost(); }, [load, loadHost]);

  async function cancelBooking(id: string) {
    setBusyId(id);
    const response = await fetch(`/api/bookings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }) });
    if (response.ok) load();
    setBusyId("");
  }

  async function respondToRequest(id: string, status: "accepted" | "declined") {
    setHostBusyId(id);
    const response = await fetch(`/api/bookings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (response.ok) loadHost();
    setHostBusyId("");
  }

  async function startPayment(id: string, provider: string) {
    setPayingId(id);
    setPayError("");
    const response = await fetch(`/api/bookings/${id}/pay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider }) });
    const result = await response.json().catch(() => ({})) as { redirectUrl?: string; error?: string };
    if (response.ok && result.redirectUrl) { window.location.assign(result.redirectUrl); return; }
    setPayError(result.error ?? t("paymentStartError"));
    setPayingId("");
  }

  async function startDeposit(id: string, method: "deposit" | "waiver", provider: string) {
    setDepositBusyId(id);
    setDepositError("");
    const endpoint = method === "deposit" ? `/api/bookings/${id}/deposit` : `/api/bookings/${id}/waiver`;
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider }) });
    const result = await response.json().catch(() => ({})) as { redirectUrl?: string; error?: string };
    if (response.ok && result.redirectUrl) { window.location.assign(result.redirectUrl); return; }
    setDepositError(result.error ?? t("paymentStartError"));
    setDepositBusyId("");
  }

  async function submitDispute(id: string) {
    if (!disputeReason.trim()) return;
    setDisputeBusy(true);
    const response = await fetch(`/api/bookings/${id}/dispute`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: disputeReason }) });
    setDisputeBusy(false);
    if (response.ok) { setDisputingId(""); setDisputeReason(""); load(); }
  }

  return (
    <>
      <AppHeader />
      <main className="workflow-page">
      <div className="page-width">
        <div className="workflow-nav"><Link className="workflow-back" href="/"><ArrowLeft size={16} /> {t("backLinkBrowse")}</Link>{!bookings && <Link className="workflow-link" href="/sign-in">{t("signIn")}</Link>}</div>
        <section className="search-results-head destination-detail-head" style={{ backgroundImage: "linear-gradient(180deg, rgba(46,20,10,.18), rgba(46,20,10,.74)), url(https://images.unsplash.com/photo-1650593963138-1d2e64afd70b?auto=format&fit=crop&w=1800&q=80)" }}>
          <p className="workflow-kicker">{t("tripsKicker")}</p>
          <h1>{t("tripsTitleLine1")}<br /><em>{t("tripsTitleLine2")}</em></h1>
        </section>
        <section className="workflow-card wide" style={{ marginTop: 24 }}>
          {paymentBanner === "success" && <p className="workflow-success">{t("paymentSuccessBanner")}</p>}
          {paymentBanner === "failed" && <p className="workflow-error">{t("paymentFailedBanner")}</p>}
          {payError && <p className="workflow-error">{payError}</p>}
          {loading && <SkeletonCards />}
          {!loading && message && (
            <div className="dashboard-message">
              <ClipboardList size={22} />
              <p>{message}</p>
              {!bookings && <Link className="workflow-link" href="/sign-in">{t("signIn")} <ArrowRight size={14} /></Link>}
            </div>
          )}

          {bookings && bookings.length === 0 && !hasVehicles && (
            <div className="empty-results compact">
              <ClipboardList size={30} />
              <h2>{t("tripsEmptyTitle")}</h2>
              <p>{t("tripsEmptyBody")}</p>
              <Link className="workflow-link" href="/search">{t("navExploreCars")} <ArrowRight size={15} /></Link>
            </div>
          )}

          {bookings && (bookings.length > 0 || hasVehicles) && (
            <>
              <h2 className="trip-section-title">{t("tripsBookedByMeTitle")}</h2>
              {bookings.length === 0 && <p className="trip-section-hint">{t("tripsBookedByMeEmpty")}</p>}
              {bookings.length > 0 && (
                <div className="trip-list">
                  {bookings.map((booking) => {
                    const isPaid = (booking.payment_records ?? []).some((record) => record.kind === "charge" && record.status === "paid");
                    const canPay = booking.status === "accepted" && !isPaid && payProviders.length > 0;
                    const depositProviders = payProviders.filter((provider) => provider.id === "stripe" || provider.id === "paypal");
                    const depositRecord = (booking.payment_records ?? []).find((record) => record.kind === "deposit_hold");
                    const waiverRecord = (booking.payment_records ?? []).find((record) => record.kind === "insurance_waiver");
                    const canChooseDeposit = (booking.status === "accepted" || booking.status === "in_progress") && !depositRecord && !waiverRecord && depositProviders.length > 0;
                    return (
                    <article className="trip-card" key={booking.id}>
                      <div className="trip-card-head">
                        <TripThumb photoPaths={booking.vehicles?.photo_paths} />
                        <div className="trip-card-head-text">
                          <strong>{booking.vehicles ? `${booking.vehicles.make} ${booking.vehicles.model}` : "Vehicle"}</strong>
                          <span className={`trip-status trip-status-${booking.status}`}>{t(statusKey[booking.status] ?? "statusRequested")}</span>
                        </div>
                      </div>
                      <p><CalendarDays size={14} /> {tripDateRange(booking.starts_at, booking.ends_at, locale)}</p>
                      <p><MapPin size={14} /> {booking.pickup_location} &rarr; {booking.return_location}</p>
                      {booking.status === "accepted" && (
                        isPaid ? (
                          <div className="pay-now-row"><span className="paid-badge"><CheckCircle2 size={15} /> {t("paymentPaidLabel")}</span></div>
                        ) : canPay && (
                          <div className="pay-now-row">
                            {payChoiceId === booking.id ? (
                              <>
                                {payProviders.map((provider) => (
                                  <PaymentProviderButton
                                    key={provider.id}
                                    provider={provider}
                                    busy={payingId === booking.id}
                                    label={payingId === booking.id ? t("paymentStarting") : (provider.id === "stripe" ? t("payWithCardLabel") : provider.label)}
                                    onClick={() => startPayment(booking.id, provider.id)}
                                  />
                                ))}
                                <button className="workflow-link" type="button" onClick={() => setPayChoiceId("")}>{t("cancel")}</button>
                              </>
                            ) : (
                              <button className="workflow-submit coral" type="button" onClick={() => setPayChoiceId(booking.id)}><CreditCard size={16} /> {t("payNowAction")}</button>
                            )}
                          </div>
                        )
                      )}
                      {depositRecord && (
                        <p className="admin-row-meta">
                          {depositRecord.status === "authorized" && t("depositHeldStatus", { amount: formatMoney(depositRecord.amount, depositRecord.currency) })}
                          {depositRecord.status === "refunded" && t("depositReleasedStatus")}
                          {depositRecord.status === "paid" && t("depositCapturedStatus")}
                          {depositRecord.status === "pending" && t("depositPendingStatus")}
                        </p>
                      )}
                      {waiverRecord && waiverRecord.status === "paid" && <p className="admin-row-meta">{t("waiverPaidStatus", { amount: formatMoney(waiverRecord.amount, waiverRecord.currency) })}</p>}
                      {depositError && <p className="workflow-error">{depositError}</p>}
                      {canChooseDeposit && (
                        <div className="pay-now-row deposit-choice-row">
                          {depositChoiceId !== booking.id ? (
                            <button className="workflow-link" type="button" onClick={() => { setDepositChoiceId(booking.id); setDepositMethod(""); }}>
                              {t("depositChooseAction")}
                            </button>
                          ) : !depositMethod ? (
                            <div className="choice-grid deposit-choice-grid">
                              <button type="button" className="choice-card" onClick={() => setDepositMethod("deposit")}>
                                <strong>{t("depositOptionDepositTitle")}</strong>
                                <span>{t("depositOptionDepositBody")}</span>
                              </button>
                              {waiverSettings.enabled && waiverSettings.dailyRate !== null && (
                                <button type="button" className="choice-card" onClick={() => setDepositMethod("waiver")}>
                                  <strong>{t("depositOptionWaiverTitle")}</strong>
                                  <span>{t("depositOptionWaiverBody", { rate: formatMoney(waiverSettings.dailyRate, waiverSettings.currency) })}</span>
                                </button>
                              )}
                              <button className="workflow-link" type="button" onClick={() => setDepositChoiceId("")}>{t("cancel")}</button>
                            </div>
                          ) : (
                            <>
                              {depositProviders.map((provider) => (
                                <PaymentProviderButton
                                  key={provider.id}
                                  provider={provider}
                                  busy={depositBusyId === booking.id}
                                  label={depositBusyId === booking.id ? t("paymentStarting") : (provider.id === "stripe" ? t("payWithCardLabel") : provider.label)}
                                  onClick={() => startDeposit(booking.id, depositMethod, provider.id)}
                                />
                              ))}
                              <button className="workflow-link" type="button" onClick={() => setDepositMethod("")}>{t("cancel")}</button>
                            </>
                          )}
                        </div>
                      )}
                      <div className="trip-footer">
                        <strong>{formatMoney(booking.total, booking.currency)}</strong>
                        <div className="trip-actions">
                          <Link className="workflow-link" href={`/messages/${booking.id}`}><MessageCircle size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />{t("messageLink")}</Link>
                          {disputableStatuses.includes(booking.status) && (
                            <Link className="workflow-link" href={`/trips/${booking.id}/condition`}><Gauge size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />{t("conditionReportLink")}</Link>
                          )}
                          {disputableStatuses.includes(booking.status) && (
                            <a className="workflow-link" href={`/api/bookings/${booking.id}/agreement`}><FileDown size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />{t("downloadAgreementLink")}</a>
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
                      {booking.status === "completed" && <ReviewPrompt bookingId={booking.id} />}
                    </article>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {hasVehicles && (
            <>
              <h2 className="trip-section-title">{t("tripsBookedFromMeTitle")}</h2>
              {(!hostBookings || hostBookings.length === 0) && <p className="trip-section-hint">{t("tripsBookedFromMeEmpty")}</p>}
              {hostBookings && hostBookings.length > 0 && (
                <div className="trip-list">
                  {hostBookings.map((booking) => {
                    const isHostBookingPaid = (booking.payment_records ?? []).some((record) => record.kind === "charge" && record.status === "paid");
                    return (
                    <article className="trip-card" key={booking.id}>
                      <div className="trip-card-head">
                        <TripThumb photoPaths={booking.vehicles?.photo_paths} />
                        <div className="trip-card-head-text">
                          <strong>{booking.vehicles ? `${booking.vehicles.make} ${booking.vehicles.model}` : "Vehicle"}</strong>
                          <span className="trip-card-badges">
                            {isHostBookingPaid && <span className="paid-badge-inline"><CheckCircle2 size={12} /> {t("paymentPaidLabel")}</span>}
                            <span className={`trip-status trip-status-${booking.status}`}>{t(statusKey[booking.status] ?? "statusRequested")}</span>
                          </span>
                        </div>
                      </div>
                      <p>{t("requestedByLabel")} <PublicProfilePopover userId={booking.renter_user_id} displayName={booking.renter_display_name ?? t("hostAnonymousLabel")} /></p>
                      <p><CalendarDays size={14} /> {tripDateRange(booking.starts_at, booking.ends_at, locale)}</p>
                      <p><MapPin size={14} /> {booking.pickup_location} &rarr; {booking.return_location}</p>
                      <div className="trip-footer">
                        <strong>{formatMoney(booking.total, booking.currency)}</strong>
                        <div className="trip-actions">
                          <Link className="workflow-link" href={`/messages/${booking.id}`}><MessageCircle size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />{t("requestMoreInfoAction")}</Link>
                          {disputableStatuses.includes(booking.status) && (
                            <Link className="workflow-link" href={`/trips/${booking.id}/condition`}><Gauge size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />{t("conditionReportLink")}</Link>
                          )}
                          {disputableStatuses.includes(booking.status) && (
                            <a className="workflow-link" href={`/api/bookings/${booking.id}/agreement`}><FileDown size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />{t("downloadAgreementLink")}</a>
                          )}
                          {booking.status === "requested" && (
                            <>
                              <button className="workflow-link" type="button" disabled={hostBusyId === booking.id} onClick={() => respondToRequest(booking.id, "accepted")}>{t("hostDashboardAccept")}</button>
                              <button className="workflow-link danger" type="button" disabled={hostBusyId === booking.id} onClick={() => respondToRequest(booking.id, "declined")}>{t("hostDashboardDecline")}</button>
                            </>
                          )}
                        </div>
                      </div>
                      {booking.status === "completed" && <ReviewPrompt bookingId={booking.id} />}
                    </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>
      </div>
      </main>
    </>
  );
}
