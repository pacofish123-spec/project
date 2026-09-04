import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";

// Backs the rebuilt own-profile card (auth-status.tsx) — everything it
// needs in one round trip: display name, photo, email (only available
// off the auth user, not the profiles table), and the latest identity
// verification status.
export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const { data: profile } = await supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle();
    const { data: verification } = await supabase
      .from("verification_records")
      .select("status")
      .eq("user_id", user.id)
      .eq("verification_type", "identity")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      email: user.email ?? null,
      verification_status: verification?.status ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to load your profile." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}
