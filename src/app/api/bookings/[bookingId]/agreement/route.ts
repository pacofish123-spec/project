import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";
import { loadAgreementData } from "@/lib/rental-agreement-service";
import { generateRentalAgreementPdf } from "@/lib/rental-agreement-pdf";

// Generated fresh on every request from the booking's current data —
// no PDF is stored — so this is also always the current source of
// truth even if the booking's details were somehow edited afterward.
// RLS on the underlying tables (bookings/vehicles) already restricts
// what loadAgreementData can see to what this caller is allowed to
// read, so a non-participant gets a 404 further down, not their data.
export async function GET(_request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    const { bookingId } = await params;
    const { supabase } = await requireUser();

    const data = await loadAgreementData(supabase, bookingId);
    if (!data) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

    const pdfBuffer = await generateRentalAgreementPdf(data);
    try {
      await supabase.rpc("record_agreement_download", { target_booking_id: bookingId });
    } catch {
      // A download should never fail just because the (best-effort)
      // counter couldn't be bumped.
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="yoRento-rental-agreement-${bookingId}.pdf"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to generate the rental agreement." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}
