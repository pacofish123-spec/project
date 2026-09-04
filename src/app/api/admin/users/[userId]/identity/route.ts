import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/authorization";
import { getStripeClient, isStripeIdentityConfigured } from "@/lib/payments/stripe";

// Backs the admin "mini profile" expand on /admin/users — the ID
// verification detail for one user, regardless of which path they took:
// manual review (actual document photos, same signed-URL pattern as
// /api/admin/verification) or automated Stripe Identity (the data
// Stripe's API exposes off the document — name/DOB/document number/
// issuing country/expiration — fetched live, never persisted here;
// Stripe doesn't hand back the raw document image over the API without
// a separate access grant this account doesn't have).
export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await params;
    const { supabase } = await requireCapability("can_manage_platform");

    const { data: record } = await supabase
      .from("verification_records")
      .select("*")
      .eq("user_id", userId)
      .eq("verification_type", "identity")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!record) return NextResponse.json({ status: "not_started" });

    if (record.provider === "stripe_identity" && record.provider_reference) {
      if (!isStripeIdentityConfigured()) {
        return NextResponse.json({ status: record.status, provider: record.provider, error: "Stripe isn't configured to fetch details." });
      }
      try {
        const stripe = getStripeClient();
        const session = await stripe.identity.verificationSessions.retrieve(record.provider_reference, { expand: ["last_verification_report"] });
        const report = typeof session.last_verification_report === "object" ? session.last_verification_report : null;
        const document = report?.document;
        const formatParts = (parts: { year: number | null; month: number | null; day: number | null } | null | undefined) =>
          parts && parts.year && parts.month && parts.day ? `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}` : null;
        return NextResponse.json({
          status: record.status,
          provider: record.provider,
          createdAt: record.created_at,
          stripeExtract: document ? {
            firstName: document.first_name ?? null,
            lastName: document.last_name ?? null,
            dob: formatParts(document.dob),
            documentType: document.type ?? null,
            documentNumber: document.number ?? null,
            issuingCountry: document.issuing_country ?? null,
            expirationDate: formatParts(document.expiration_date),
          } : null,
        });
      } catch (stripeError) {
        console.error("admin/users/[userId]/identity Stripe error:", stripeError);
        return NextResponse.json({ status: record.status, provider: record.provider, error: "Unable to fetch details from Stripe." });
      }
    }

    const documentPaths = record.document_paths ?? [];
    const { data: signed } = documentPaths.length ? await supabase.storage.from("identity-documents").createSignedUrls(documentPaths, 3600) : { data: [] };
    const documentUrls = (signed ?? []).map((entry) => entry.signedUrl).filter((url): url is string => Boolean(url));

    return NextResponse.json({ status: record.status, provider: record.provider, createdAt: record.created_at, documentUrls });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "CAPABILITY_REQUIRED" ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? "Admin access required." : "Unable to load identity details." }, { status });
  }
}
