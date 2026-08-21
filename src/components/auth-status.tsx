"use client";

import Link from "next/link";
import { LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useLanguage } from "@/lib/i18n";

// Full account panel used standalone on /profile. The header's own
// signed-in/out control is AuthMenu, a popover — this component only
// renders the "full" layout that used to be one of its two variants.
export function AuthStatus() {
  const router = useRouter();
  const { t } = useLanguage();
  // undefined = still checking, null = signed out, string = signed-in email
  const [email, setEmail] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { queueMicrotask(() => setEmail(null)); return; }
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setEmail(session?.user?.email ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut();
    setEmail(null);
    router.push("/");
    router.refresh();
  }

  if (email === undefined) return <p className="workflow-kicker">{t("authCheckingSession")}</p>;

  if (!email) {
    return (
      <div className="profile-menu">
        <Link href="/sign-in"><UserRound size={18} /><span>{t("authSignInOrCreate")}</span></Link>
        <Link href="/host"><span>{t("authBecomeHost")}</span></Link>
        <Link href="/recover"><span>{t("authRecoverAccount")}</span></Link>
      </div>
    );
  }

  return (
    <div className="profile-signed-in">
      <p className="workflow-kicker">{t("authSignedInAs")}</p>
      <p className="profile-email">{email}</p>
      <div className="profile-menu">
        <Link href="/trips"><span>{t("authMyTrips")}</span></Link>
        <Link href="/host/dashboard"><span>{t("authHostDashboard")}</span></Link>
        <Link href="/verify-id"><ShieldCheck size={18} /><span>{t("authVerifyIdentity")}</span></Link>
      </div>
      <button className="workflow-submit" type="button" onClick={signOut}><LogOut size={17} /> {t("authSignOut")}</button>
    </div>
  );
}
