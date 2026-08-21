import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/authorization";
import { createStripeRefund } from "@/lib/payments/stripe";
import { refundPaypalCapture } from "@/lib/payments/paypal";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(_request: Request, { params }: { params: Promise<{ recordId: string }> }) {
  try {
    const { recordId } = await params;
    const { supabase } = await requireCapability("can_manage_platform");

    const { data: record, error: recordError } = await supabase.from("payment_records").select("*").eq("id", recordId).single();
    if (recordError || !record) return NextResponse.json({ error: "Payment not found." }, { status: 404 });
    if (record.kind !== "charge" || record.status !== "paid") return NextResponse.json({ error: "Only a paid charge can be refunded." }, { status: 409 });
    if (!record.processor_reference) return NextResponse.json({ error: "This payment has no processor reference to refund against." }, { status: 409 });

    if (record.provider === "stripe") await createStripeRefund(record.processor_reference);
    else if (record.provider === "paypal") await refundPaypalCapture(record.processor_reference);
    else return NextResponse.json({ error: `Refunds for ${record.provider} aren't available yet.` }, { status: 400 });

    // Refund API calls above already confirmed the processor accepted
    // the refund — the admin client write below just brings our own
    // ledger row in sync with what the processor now shows, following
    // the same "already admin-verified, service role for the write"
    // rule documented in src/lib/supabase/admin.ts.
    const admin = createSupabaseAdminClient();
    if (admin) {
      await admin.from("payment_records").update({ status: "refunded", updated_at: new Date().toISOString() }).eq("id", recordId);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "CAPABILITY_REQUIRED" ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? "Admin access required." : "Unable to process refund." }, { status });
  }
}
