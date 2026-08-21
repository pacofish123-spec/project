"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck, UserRound } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { hasCapability } from "@/lib/capabilities";
import { useLanguage } from "@/lib/i18n";
import { OAuthButtons } from "@/components/oauth-buttons";

// Header account control: a coral-filled icon plus a first-name greeting
// when signed in, opening a popover instead of navigating away. Signed
// out, the popover holds a compact sign-in (OAuth + email/password);
// signed in, it holds the account menu. Only sign-up (which needs more
// fields than fit here) and password recovery still go to a full page.
export function AuthMenu() {
  const router = useRouter();
  const { t } = useLanguage();
  // undefined = still checking, null = signed out, string = signed-in email
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [open, setOpen] = useState(false);
  const [signInBusy, setSignInBusy] = useState(false);
  const [signInError, setSignInError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { queueMicrotask(() => setEmail(null)); return; }
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setEmail(session?.user?.email ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!email) { queueMicrotask(() => { setFirstName(null); setIsAdmin(false); setIsHost(false); }); return; }
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (!user || cancelled) return;
      const [{ data: profile }, admin, ownedVehicles, memberships] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
        hasCapability(supabase, user.id, "can_manage_platform"),
        supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("owner_user_id", user.id),
        supabase.from("business_members").select("business_id").eq("user_id", user.id),
      ]);
      if (cancelled) return;
      const source = (profile?.display_name as string | undefined)?.trim() || email.split("@")[0];
      setFirstName(source.split(/\s+/)[0]);
      setIsAdmin(admin);

      // "Host dashboard" only means something once you've actually listed
      // a car — every account gets can_host_personally by default, so that
      // capability alone can't gate this the way it gates real permissions.
      let host = (ownedVehicles.count ?? 0) > 0;
      const businessIds = (memberships.data ?? []).map((membership) => membership.business_id);
      if (!host && businessIds.length > 0) {
        const { count: businessVehicleCount } = await supabase.from("vehicles").select("id", { count: "exact", head: true }).in("business_id", businessIds);
        host = (businessVehicleCount ?? 0) > 0;
      }
      if (!cancelled) setIsHost(host);
    });
    return () => { cancelled = true; };
  }, [email]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSignInError("");
    setSignInBusy(true);
    const form = new FormData(event.currentTarget);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setSignInError(t("signInNotConfigured")); setSignInBusy(false); return; }
    const { error } = await supabase.auth.signInWithPassword({ email: String(form.get("email")), password: String(form.get("password")) });
    setSignInBusy(false);
    if (error) { setSignInError(t("signInFailed")); return; }
    setOpen(false);
    router.refresh();
  }

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut();
    setEmail(null);
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  const signedIn = Boolean(email);

  return (
    <div className="lang-dropdown auth-menu" ref={rootRef}>
      {signedIn && firstName && <span className="auth-greeting">{t("authWelcomeGreeting", { name: firstName })}</span>}
      {signedIn && isAdmin && <Link href="/admin" className="admin-nav-badge" onClick={() => setOpen(false)}><ShieldCheck size={13} /> Admin</Link>}
      <button
        className={`profile-button ${signedIn ? "profile-button-signed-in" : ""}`}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={signedIn ? t("authAccountMenu") : t("signIn")}
        onClick={() => setOpen((value) => !value)}
      >
        <UserRound size={18} />
      </button>

      {open && !signedIn && (
        <div className="lang-dropdown-menu auth-dropdown-menu">
          <p className="workflow-kicker">{t("signInKicker")}</p>
          <OAuthButtons />
          {signInError && <p className="workflow-error">{signInError}</p>}
          <form className="workflow-form" onSubmit={handleSignIn}>
            <label>{t("emailLabel")}<input name="email" type="email" autoComplete="email" required /></label>
            <label>{t("passwordLabel")}<input name="password" type="password" autoComplete="current-password" required /></label>
            <button className="workflow-submit" disabled={signInBusy} type="submit">{signInBusy ? t("signInSubmitBusy") : t("signInSubmit")}</button>
          </form>
          <div className="auth-menu-footer">
            <Link href="/recover" onClick={() => setOpen(false)}>{t("signInRecoverLink")}</Link>
            <Link href="/sign-up" onClick={() => setOpen(false)}>{t("signInCreateAccountLink")}</Link>
          </div>
        </div>
      )}

      {open && signedIn && (
        <div className="lang-dropdown-menu auth-dropdown-menu">
          <p className="workflow-kicker">{t("authSignedInAs")}</p>
          <p className="profile-email">{firstName ? t("authWelcomeGreeting", { name: firstName }) : email}</p>
          <div className="profile-menu">
            {isAdmin && <Link href="/admin" onClick={() => setOpen(false)}><ShieldCheck size={15} /><span>Admin panel</span></Link>}
            <Link href="/profile" onClick={() => setOpen(false)}><span>{t("authMyProfile")}</span></Link>
            <Link href="/trips" onClick={() => setOpen(false)}><span>{t("authMyTrips")}</span></Link>
            {isHost
              ? <Link href="/host/dashboard" onClick={() => setOpen(false)}><span>{t("authHostDashboard")}</span></Link>
              : <Link href="/host" onClick={() => setOpen(false)}><span>{t("authBecomeHost")}</span></Link>}
          </div>
          <button className="workflow-submit" type="button" onClick={signOut}><LogOut size={16} /> {t("authSignOut")}</button>
        </div>
      )}
    </div>
  );
}
