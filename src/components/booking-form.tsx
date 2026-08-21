"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Minus, Plus, ShieldCheck } from "lucide-react";
import { CalendarPicker } from "@/components/calendar-picker";
import { LocationAutocomplete } from "@/components/location-autocomplete";
import { formatMoney } from "@/lib/format";
import { useLanguage } from "@/lib/i18n";

export interface BookingExtraOption {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  inventory_count: number | null;
}

interface Quote {
  rental_days: number;
  gross_subtotal: number;
  discount_total: number;
  taxes_total: number;
  platform_fee: number;
  total: number;
  currency: string;
}

export function BookingForm({ vehicleId, status, extras, countryCode }: { vehicleId: string; status: string; extras: BookingExtraOption[]; countryCode: string }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("10:00");
  const [pickupLocation, setPickupLocation] = useState("");
  const [returnLocation, setReturnLocation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [selectedExtras, setSelectedExtras] = useState<Record<string, number>>({});

  const startsAt = startDate ? `${startDate}T${startTime || "00:00"}` : "";
  const endsAt = endDate ? `${endDate}T${endTime || "00:00"}` : "";

  useEffect(() => {
    if (!startsAt || !endsAt) { queueMicrotask(() => setQuote(null)); return; }
    queueMicrotask(() => setQuoteLoading(true));
    fetch(`/api/vehicles/${vehicleId}/quote?startDate=${encodeURIComponent(startsAt)}&endDate=${encodeURIComponent(endsAt)}`).then(async (response) => {
      const result = await response.json() as { quote?: Quote };
      setQuote(response.ok ? result.quote ?? null : null);
    }).catch(() => setQuote(null)).finally(() => setQuoteLoading(false));
  }, [vehicleId, startsAt, endsAt]);

  if (status !== "published") {
    return <p className="workflow-error">{t("vehicleNotAvailable")}</p>;
  }

  function setExtraQuantity(extraId: string, quantity: number) {
    setSelectedExtras((current) => {
      const next = { ...current };
      if (quantity <= 0) delete next[extraId];
      else next[extraId] = quantity;
      return next;
    });
  }

  // Extras aren't currency-locked to the vehicle (a host can set any
  // currency when creating one), so summing them together only makes
  // sense within a single currency — mixing them under the vehicle's
  // currency label would misstate the amount. Only the extras that
  // actually match the quote's currency count toward the total shown
  // alongside it; anything else stays visible per-line above but out of
  // the merged sum.
  const extrasTotal = quote
    ? Object.entries(selectedExtras).reduce((sum, [extraId, quantity]) => {
        const extra = extras.find((item) => item.id === extraId);
        return extra && extra.currency === quote.currency ? sum + extra.price * quantity : sum;
      }, 0)
    : 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!startDate || !endDate || !pickupLocation || !returnLocation) {
      setMessage(t("bookingChooseDatesError"));
      return;
    }
    setBusy(true);
    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicleId, startsAt, endsAt, pickupLocation, returnLocation }),
    });
    const result = await response.json() as { error?: string; booking?: { id: string } };
    if (!response.ok || !result.booking) { setBusy(false); setMessage(result.error ?? t("bookingGenericError")); return; }

    await Promise.all(Object.entries(selectedExtras).map(([extraId, quantity]) => {
      const extra = extras.find((item) => item.id === extraId);
      if (!extra) return Promise.resolve();
      return fetch(`/api/bookings/${result.booking!.id}/extras`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extraId, quantity, unitPrice: extra.price }),
      });
    }));

    setBusy(false);
    router.push("/trips");
  }

  return (
    <form className="workflow-form booking-form" onSubmit={handleSubmit}>
      <CalendarPicker startDate={startDate} endDate={endDate} onChange={(nextStart, nextEnd) => { setStartDate(nextStart); setEndDate(nextEnd); setMessage(""); }} />
      <div className="field-grid">
        <label>{t("bookingPickupTimeLabel")}<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required /></label>
        <label>{t("bookingReturnTimeLabel")}<input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required /></label>
      </div>
      <p className="field-hint" style={{ margin: "-9px 0 4px" }}>{t("bookingTimeHint")}</p>
      <div className="field-grid">
        <label>{t("bookingPickupLabel")}<LocationAutocomplete value={pickupLocation} onChange={setPickupLocation} countryCode={countryCode} placeholder={t("bookingPickupPlaceholder")} required /></label>
        <label>{t("bookingReturnLabel")}<LocationAutocomplete value={returnLocation} onChange={setReturnLocation} countryCode={countryCode} placeholder={t("bookingReturnPlaceholder")} required /></label>
      </div>

      {extras.length > 0 && (
        <div className="extras-picker">
          <p className="workflow-kicker">{t("extrasSectionTitle")}</p>
          {extras.map((extra) => {
            const quantity = selectedExtras[extra.id] ?? 0;
            return (
              <div className="extra-row" key={extra.id}>
                <div>
                  <strong>{extra.name}</strong>
                  <span>{formatMoney(extra.price, extra.currency)}</span>
                </div>
                <div className="extra-stepper">
                  <button type="button" aria-label={`Fewer ${extra.name}`} disabled={quantity === 0} onClick={() => setExtraQuantity(extra.id, quantity - 1)}><Minus size={14} /></button>
                  <span>{quantity}</span>
                  <button type="button" aria-label={`More ${extra.name}`} disabled={extra.inventory_count !== null && quantity >= extra.inventory_count} onClick={() => setExtraQuantity(extra.id, quantity + 1)}><Plus size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {quoteLoading && <p className="admin-row-meta">{t("loadingPrice")}</p>}
      {quote && (
        <div className="price-breakdown">
          <div><span>{t("priceBreakdownSubtotal")}</span><span>{formatMoney(quote.gross_subtotal, quote.currency)}</span></div>
          {quote.discount_total > 0 && <div className="discount-line"><span>{t("priceBreakdownDiscount")}</span><span>-{formatMoney(quote.discount_total, quote.currency)}</span></div>}
          <div><span>{t("priceBreakdownTaxes")}</span><span>{formatMoney(quote.taxes_total, quote.currency)}</span></div>
          <div><span>{t("priceBreakdownFee")}</span><span>{formatMoney(quote.platform_fee, quote.currency)}</span></div>
          <div className="price-total"><span>{t("priceBreakdownTotal")}</span><span>{formatMoney(quote.total, quote.currency)}</span></div>
          {extrasTotal > 0 && (
            <div className="extras-pending-note"><span>{t("extrasSectionTitle")}: {formatMoney(extrasTotal, quote.currency)}</span><span>{t("extrasPendingHostApproval")}</span></div>
          )}
        </div>
      )}

      {message && <p className="workflow-error">{message}</p>}
      <button className="workflow-submit coral" disabled={busy} type="submit"><CalendarDays size={17} />{busy ? t("bookingSubmitBusy") : t("bookingSubmit")}</button>
      <p className="admin-row-meta"><ShieldCheck size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />{t("vehiclePricingNote")}</p>
    </form>
  );
}
