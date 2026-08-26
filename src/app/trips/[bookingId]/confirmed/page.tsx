"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, CarFront, CheckCircle2, MessageCircle } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { formatDate, formatMoney } from "@/lib/format";
import { useLanguage, localeByLanguage } from "@/lib/i18n";
import { vehiclePhotoUrl } from "@/lib/storage-url";

interface ConfirmedBooking {
  id: string;
  starts_at: string;
  ends_at: string;
  total: number;
  currency: string;
  vehicles?: { make: string; model: string; year: number; photo_paths?: string[] | null } | null;
}

// Dedicated "thank you" stop between submitting a booking request and
// landing back in the trips list — booking-form.tsx routes here on
// success instead of straight to /trips. Reuses the existing renter
// bookings list endpoint rather than adding a single-booking GET route.
export default function BookingConfirmedPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = use(params);
  const { t, language } = useLanguage();
  const [booking, setBooking] = useState<ConfirmedBooking | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/bookings")
      .then((response) => (response.ok ? response.json() : null))
      .then((result: { bookings?: ConfirmedBooking[] } | null) => {
        setBooking(result?.bookings?.find((item) => item.id === bookingId) ?? null);
      })
      .catch(() => setBooking(null));
  }, [bookingId]);

  const photoUrl = booking?.vehicles?.photo_paths?.[0] ? vehiclePhotoUrl(booking.vehicles.photo_paths[0]) : null;

  return (
    <>
      <AppHeader />
      <main className="workflow-page">
        <div className="page-width">
          <section className="workflow-card" style={{ textAlign: "center" }}>
            <CheckCircle2 size={44} style={{ margin: "0 auto 18px", color: "var(--pine, #183b32)" }} />
            <h1>{t("bookingConfirmedTitle")}</h1>
            <p className="workflow-intro">{t("bookingConfirmedSubtitle")}</p>

            {booking && (
              <div className="trip-card" style={{ margin: "28px 0", textAlign: "left" }}>
                <div className="vehicle-image" style={{ position: "relative", minHeight: 160, borderRadius: 8, overflow: "hidden" }}>
                  {photoUrl ? <Image src={photoUrl} alt={`${booking.vehicles?.make} ${booking.vehicles?.model}`} fill sizes="600px" style={{ objectFit: "cover" }} /> : <div className="vehicle-image-placeholder" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}><CarFront size={32} /></div>}
                </div>
                <p style={{ margin: "14px 0 4px", fontWeight: 700 }}>{booking.vehicles ? `${booking.vehicles.make} ${booking.vehicles.model} · ${booking.vehicles.year}` : ""}</p>
                <p className="admin-row-meta" style={{ display: "flex", alignItems: "center", gap: 6 }}><CalendarDays size={14} /> {formatDate(booking.starts_at, localeByLanguage[language])} – {formatDate(booking.ends_at, localeByLanguage[language])}</p>
                <p style={{ margin: "10px 0 0", fontWeight: 700 }}>{formatMoney(booking.total, booking.currency)}</p>
                <p className="admin-row-meta" style={{ marginTop: 6 }}>{t("bookingConfirmedStatusNote")}</p>
              </div>
            )}
            {booking === null && <p className="workflow-error">{t("bookingConfirmedNotFound")}</p>}

            <div className="profile-menu">
              <Link href="/trips"><span>{t("bookingConfirmedViewTrips")}</span></Link>
              <Link href={`/messages/${bookingId}`}><MessageCircle size={18} /><span>{t("bookingConfirmedMessageHost")}</span></Link>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
