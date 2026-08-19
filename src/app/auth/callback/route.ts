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
  return NextResponse.redirect(new URL(isNewUser ? "/onboarding/confirm-identity" : "/", request.url));
}
