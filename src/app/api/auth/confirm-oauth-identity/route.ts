import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";
import { normalizePhone } from "@/lib/identity";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { phone?: string; dateOfBirth?: string };
    const { supabase, user } = await requireUser();

    const normalizedPhone = body.phone ? normalizePhone(body.phone) : null;
    const displayName = (user.user_metadata?.display_name as string | undefined)
      ?? (user.user_metadata?.full_name as string | undefined)
      ?? (user.user_metadata?.name as string | undefined)
      ?? null;

    if (body.phone || body.dateOfBirth) {
      await supabase.from("profiles").update({
        phone: body.phone || null,
        normalized_phone: normalizedPhone,
        date_of_birth: body.dateOfBirth || null,
        updated_at: new Date().toISOString(),
      }).eq("id", user.id);
    }

    const { data, error } = await supabase.rpc("check_and_flag_oauth_identity", {
      registration_phone: normalizedPhone,
      registration_name: displayName,
      registration_date_of_birth: body.dateOfBirth || null,
    });

    if (error) return NextResponse.json({ error: "Unable to verify your details." }, { status: 500 });

    const flagged = data === "STRONG_MATCH" || data === "CONFIRMED_MATCH";
    return NextResponse.json({ flagged });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to save your details." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}
