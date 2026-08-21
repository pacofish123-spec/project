import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";
import { isStripeIdentityConfigured } from "@/lib/payments/stripe";

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase.from("verification_records")
      .select("id, status, provider, created_at")
      .eq("user_id", user.id).eq("verification_type", "identity")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return NextResponse.json({ error: "Unable to load verification status." }, { status: 500 });
    return NextResponse.json({ verification: data, automatedAvailable: isStripeIdentityConfigured() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to load verification status." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}
