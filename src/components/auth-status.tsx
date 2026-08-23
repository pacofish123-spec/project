"use client";

import Link from "next/link";
import { LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useLanguage } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/translations";
import { ProfilePhotoPicker } from "@/components/profile-photo-picker";
import { VerifiedAvatar } from "@/components/verified-avatar";

interface Profile {
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
  verification_status: string | null;
}

const verificationStatusKey: Record<string, TranslationKey> = {
  not_started: "verificationNotStarted",
  pending: "verificationPending",
  in_review: "verificationInReview",
  verified: "verificationVerified",
  failed: "verificationFailed",
  requires_information: "verificationRequiresInformation",
  expired: "verificationExpired",
};

// Full account panel used standalone on /profile. The header's own
// signed-in/out control is AuthMenu, a popover — this component only
// renders the "full" layout that used to be one of its two variants.
export function AuthStatus() {
  const router = useRouter();
  const { t } = useLanguage();
  // undefined = still checking, null = signed out, string = signed-in email
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  // Read directly off the URL (no useSearchParams — avoids forcing this
  // whole client component behind a Suspense boundary just for one
  // optional flag) — set by booking-form/host-cars-new when a
  // PROFILE_PHOTO_REQUIRED redirect lands here.
  const [photoRequired, setPhotoRequired] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setPhotoRequired(new URLSearchParams(window.location.search).get("photoRequired") === "1"));
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { queueMicrotask(() => setEmail(null)); return; }
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setEmail(session?.user?.email ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!email) return;
    fetch("/api/profile/me").then(async (response) => {
      if (!response.ok) return;
      setProfile(await response.json() as Profile);
    }).catch(() => {});
  }, [email]);

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

  const verificationLabel = profile?.verification_status ? t(verificationStatusKey[profile.verification_status] ?? "verificationNotStarted") : t("verificationNotStarted");

  return (
    <div className="profile-signed-in">
      <div className="profile-card-head">
        <VerifiedAvatar avatarUrl={profile?.avatar_url} verified={profile?.verification_status === "verified"} size="large" />
        <div>
          <strong className="profile-display-name">{profile?.display_name || t("hostAnonymousLabel")}</strong>
          <p className="profile-email">{email}</p>
          <span className={`trip-status ${profile?.verification_status === "verified" ? "trip-status-accepted" : profile?.verification_status === "failed" ? "trip-status-declined" : ""}`}>{verificationLabel}</span>
        </div>
      </div>

      {(photoRequired || (profile && !profile.avatar_url)) && (
        <div className="profile-pending-task">
          <p className="workflow-kicker">{t("profilePendingTaskTitle")}</p>
          <p className="admin-row-meta">{t("profilePhotoMissingBody")}</p>
          <ProfilePhotoPicker onSaved={(url) => setProfile((current) => current ? { ...current, avatar_url: url } : current)} />
        </div>
      )}

      <div className="profile-menu">
        <Link href="/trips"><span>{t("authMyTrips")}</span></Link>
        <Link href="/host/dashboard"><span>{t("authHostDashboard")}</span></Link>
        <Link href="/verify-id"><ShieldCheck size={18} /><span>{t("authVerifyIdentity")}</span></Link>
      </div>
      <button className="workflow-submit" type="button" onClick={signOut}><LogOut size={17} /> {t("authSignOut")}</button>
    </div>
  );
}
