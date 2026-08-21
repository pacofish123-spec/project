import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  let isNewUser = false;
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);
    const user = data.user;
    // Supabase sets created_at === last_sign_in_at on a brand-new account's
    // first sign-in. A returning OAuth user won't match this.
    if (user?.created_at && user?.last_sign_in_at) {
      isNewUser = new Date(user.created_at).getTime() === new Date(user.last_sign_in_at).getTime();
    }
  }

  // Only a same-origin relative path is ever honored here — "next"
  // rides through the OAuth provider and back, so treat it the same as
  // any other untrusted redirect target (no protocol-relative "//evil"
  // or absolute URLs allowed out to a different host).
  const next = url.searchParams.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;

  // Admins land on the normal homepage like everyone else — the header's
  // AuthMenu surfaces an Admin link for them instead of forcing a
  // separate landing page here. A requested return path only applies
  // for a returning user finishing something specific (like a
  // booking) — a brand-new signup still goes through onboarding first.
  const destination = isNewUser ? "/onboarding/confirm-identity" : (safeNext ?? "/");
  return NextResponse.redirect(new URL(destination, request.url));
}
