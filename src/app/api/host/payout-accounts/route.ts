import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase.from("payout_accounts").select("*").eq("user_id", user.id);
    if (error) return NextResponse.json({ error: "Unable to load payout accounts." }, { status: 500 });
    return NextResponse.json({ accounts: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to load payout accounts." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}

// PayPal Payouts needs nothing but the recipient's email — no OAuth
// "connect" step exists for this product, so this is a plain save.
export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string };
    const email = (body.email ?? "").trim();
    if (!email || !email.includes("@")) return NextResponse.json({ error: "Enter a valid PayPal email address." }, { status: 400 });

    const { supabase, user } = await requireUser();
    const { data, error } = await supabase.from("payout_accounts")
      .upsert({ user_id: user.id, provider: "paypal", external_account_id: email, status: "active", updated_at: new Date().toISOString() }, { onConflict: "user_id,provider" })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: "Unable to save your PayPal payout email." }, { status: 500 });
    return NextResponse.json({ account: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to save payout account." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}
