import type { SupabaseClient } from "@supabase/supabase-js";
import { generateRentalAgreementPdf, type RentalAgreementData } from "@/lib/rental-agreement-pdf";
import { isEmailConfigured, sendEmail } from "@/lib/email/resend";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatMoney } from "@/lib/format";

interface BookingRow {
  id: string;
  created_at: string;
  starts_at: string;
  ends_at: string;
  pickup_location: string;
  return_location: string;
  total: number;
  currency: string;
  platform_fee: number;
  renter_user_id: string;
  vehicle_id: string;
}

interface VehicleRow {
  make: string;
  model: string;
  year: number;
  location_city: string;
  country_code: string;
  owner_user_id: string;
  transmission: string | null;
  seats: number | null;
  fuel_policy: string | null;
  cleaning_policy: string | null;
}

// Builds the same RentalAgreementData shape the PDF and the download
// route both need, from a booking's own id — one place that decides
// what "the rental agreement" actually contains.
export async function loadAgreementData(supabase: SupabaseClient, bookingId: string): Promise<RentalAgreementData | null> {
  const { data: booking } = await supabase.from("bookings").select("*").eq("id", bookingId).maybeSingle<BookingRow>();
  if (!booking) return null;

  const { data: vehicle } = await supabase.from("vehicles").select("*").eq("id", booking.vehicle_id).maybeSingle<VehicleRow>();
  if (!vehicle) return null;

  const { data: profiles } = await supabase.from("public_profiles").select("id, display_name").in("id", [booking.renter_user_id, vehicle.owner_user_id]);
  const nameFor = (id: string) => profiles?.find((profile) => profile.id === id)?.display_name ?? "yoRento user";

  const admin = createSupabaseAdminClient();
  let hostEmail: string | null = null;
  let renterEmail: string | null = null;
  if (admin) {
    const [hostUser, renterUser] = await Promise.all([
      admin.auth.admin.getUserById(vehicle.owner_user_id),
      admin.auth.admin.getUserById(booking.renter_user_id),
    ]);
    hostEmail = hostUser.data.user?.email ?? null;
    renterEmail = renterUser.data.user?.email ?? null;
  }

  return {
    bookingId: booking.id,
    createdAt: booking.created_at,
    startsAt: booking.starts_at,
    endsAt: booking.ends_at,
    pickupLocation: booking.pickup_location,
    returnLocation: booking.return_location,
    total: Number(booking.total),
    currency: booking.currency,
    platformFee: Number(booking.platform_fee),
    vehicle: {
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      locationCity: vehicle.location_city,
      countryCode: vehicle.country_code,
      transmission: vehicle.transmission,
      seats: vehicle.seats,
      fuelPolicy: vehicle.fuel_policy,
      cleaningPolicy: vehicle.cleaning_policy,
    },
    host: { name: nameFor(vehicle.owner_user_id), email: hostEmail },
    renter: { name: nameFor(booking.renter_user_id), email: renterEmail },
  };
}

function rentalAgreementEmailHtml(data: RentalAgreementData): string {
  const vehicleLabel = `${data.vehicle.year} ${data.vehicle.make} ${data.vehicle.model}`;
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #172521;">
      <h1 style="font-size: 22px; margin-bottom: 4px;">yo<span style="color:#e96f4c;">Rento</span></h1>
      <p style="color: #647069; font-size: 13px; margin-top: 0;">Your booking is confirmed</p>
      <p>Your rental agreement for the <strong>${vehicleLabel}</strong> is attached to this email as a PDF.</p>
      <table style="width: 100%; font-size: 13px; margin: 20px 0; border-collapse: collapse;">
        <tr><td style="padding: 6px 0; color: #647069;">Pick-up</td><td style="padding: 6px 0;">${formatDate(data.startsAt)} · ${data.pickupLocation}</td></tr>
        <tr><td style="padding: 6px 0; color: #647069;">Return</td><td style="padding: 6px 0;">${formatDate(data.endsAt)} · ${data.returnLocation}</td></tr>
        <tr><td style="padding: 6px 0; color: #647069;">Total</td><td style="padding: 6px 0;">${formatMoney(data.total, data.currency)}</td></tr>
      </table>
      <p style="font-size: 13px; color: #647069;">You can also download this agreement any time from My Trips on yoRento.</p>
    </div>
  `;
}

// Fire-and-forget from the booking-accept route — a failure here (no
// email provider configured, a bad address, a PDF error) must never
// undo the host's accept action, so every caller wraps this in a
// .catch() rather than awaiting it inline with the response.
export async function deliverRentalAgreement(supabase: SupabaseClient, bookingId: string): Promise<void> {
  const data = await loadAgreementData(supabase, bookingId);
  if (!data) return;

  const admin = createSupabaseAdminClient();
  let emailedAt: string | null = null;
  let emailError: string | null = null;

  if (isEmailConfigured() && data.renter.email) {
    try {
      const pdfBuffer = await generateRentalAgreementPdf(data);
      await sendEmail({
        to: data.renter.email,
        subject: `Your yoRento rental agreement — ${data.vehicle.year} ${data.vehicle.make} ${data.vehicle.model}`,
        html: rentalAgreementEmailHtml(data),
        attachments: [{ filename: `yoRento-rental-agreement-${bookingId}.pdf`, content: pdfBuffer }],
      });
      emailedAt = new Date().toISOString();
    } catch (error) {
      emailError = error instanceof Error ? error.message : "EMAIL_SEND_FAILED";
      console.error("deliverRentalAgreement email error:", error);
    }
  }

  if (admin) {
    await admin.from("rental_agreements").upsert({
      booking_id: bookingId,
      generated_at: new Date().toISOString(),
      emailed_at: emailedAt,
      email_error: emailError,
      updated_at: new Date().toISOString(),
    }, { onConflict: "booking_id" });
  }

  await supabase.rpc("notify_rental_agreement_ready", { target_booking_id: bookingId });
}
