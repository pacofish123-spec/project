"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Upload, UserCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useLanguage } from "@/lib/i18n";

// Three ways to satisfy the profile-photo requirement, all landing in
// the same place: profiles.avatar_url. An OAuth photo is just an
// external URL — no re-hosting needed, the app already renders
// avatar_url directly regardless of where it points (host cards,
// popovers, etc). Upload and selfie both go through the same
// square-crop-then-store-in-`avatars` path, mirroring the vehicle-photo
// upload pattern in host/cars/new.
export function ProfilePhotoPicker({ onSaved }: { onSaved?: (url: string) => void }) {
  const { t } = useLanguage();
  const [oauthAvatarUrl, setOauthAvatarUrl] = useState<string | null>(null);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      const metadata = data.user?.user_metadata as Record<string, unknown> | undefined;
      const fromMetadata = (metadata?.avatar_url as string | undefined) || (metadata?.picture as string | undefined);
      setOauthAvatarUrl(fromMetadata || null);
    });
    supabase.from("profiles").select("avatar_url").then(({ data }) => setCurrentAvatarUrl((data?.[0] as { avatar_url?: string } | undefined)?.avatar_url ?? null));
  }, []);

  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach((track) => track.stop()); };
  }, []);

  async function saveAvatarUrl(url: string) {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { error: updateError } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userData.user.id);
    if (updateError) { setError(t("profilePhotoSaveError")); return; }
    setCurrentAvatarUrl(url);
    onSaved?.(url);
  }

  async function useOAuthPhoto() {
    if (!oauthAvatarUrl) return;
    setBusy(true);
    setError("");
    await saveAvatarUrl(oauthAvatarUrl);
    setBusy(false);
  }

  // Every path (upload or selfie) funnels through this: draw whatever
  // image source onto a fixed-size square canvas (center-cropped), so
  // every avatar renders consistently in the circular frames used
  // everywhere, regardless of the source photo's aspect ratio.
  function cropToSquareBlob(source: CanvasImageSource, sourceWidth: number, sourceHeight: number): Promise<Blob | null> {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return Promise.resolve(null);
    const cropSize = Math.min(sourceWidth, sourceHeight);
    const sx = (sourceWidth - cropSize) / 2;
    const sy = (sourceHeight - cropSize) / 2;
    ctx.drawImage(source, sx, sy, cropSize, cropSize, 0, 0, size, size);
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9));
  }

  async function uploadBlob(blob: Blob) {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    setError("");
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setBusy(false); return; }
    const path = `${userData.user.id}/${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg" });
    if (uploadError) { setError(t("profilePhotoSaveError")); setBusy(false); return; }
    const publicUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    await saveAvatarUrl(publicUrl);
    setBusy(false);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = async () => {
      const blob = await cropToSquareBlob(img, img.naturalWidth, img.naturalHeight);
      URL.revokeObjectURL(objectUrl);
      if (blob) await uploadBlob(blob);
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); setError(t("profilePhotoSaveError")); };
    img.src = objectUrl;
  }

  async function openCamera() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) { fileInputRef.current?.click(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      setCameraOpen(true);
      setCameraError(false);
      // The <video> element only mounts once cameraOpen is true, so the
      // stream is attached on the next tick rather than right here.
      queueMicrotask(() => { if (videoRef.current) videoRef.current.srcObject = stream; });
    } catch {
      setCameraError(true);
      fileInputRef.current?.click();
    }
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  async function captureSelfie() {
    const video = videoRef.current;
    if (!video) return;
    const blob = await cropToSquareBlob(video, video.videoWidth, video.videoHeight);
    closeCamera();
    if (blob) await uploadBlob(blob);
  }

  return (
    <div className="profile-photo-picker">
      <div className="profile-photo-preview">
        <span className="host-avatar large">{currentAvatarUrl ? <img src={currentAvatarUrl} alt="" /> : <Camera size={26} />}</span>
      </div>

      {!cameraOpen && (
        <div className="profile-photo-actions">
          {oauthAvatarUrl && oauthAvatarUrl !== currentAvatarUrl && (
            <button className="workflow-link" type="button" disabled={busy} onClick={useOAuthPhoto}>
              <UserCheck size={14} style={{ verticalAlign: "-2px", marginRight: 5 }} />{t("profilePhotoUseOAuth")}
            </button>
          )}
          <button className="workflow-link" type="button" disabled={busy} onClick={() => fileInputRef.current?.click()}>
            <Upload size={14} style={{ verticalAlign: "-2px", marginRight: 5 }} />{t("profilePhotoUpload")}
          </button>
          <button className="workflow-link" type="button" disabled={busy} onClick={openCamera}>
            <Camera size={14} style={{ verticalAlign: "-2px", marginRight: 5 }} />{t("profilePhotoTakeSelfie")}
          </button>
        </div>
      )}

      {cameraOpen && (
        <div className="profile-photo-camera">
          <video ref={videoRef} autoPlay playsInline muted />
          <div className="profile-photo-actions">
            <button className="workflow-submit coral" type="button" onClick={captureSelfie}><Camera size={15} /> {t("profilePhotoCapture")}</button>
            <button className="workflow-link" type="button" onClick={closeCamera}>{t("profilePhotoCancel")}</button>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" capture="user" hidden onChange={handleFileChange} />
      {cameraError && <p className="admin-row-meta">{t("profilePhotoCameraUnavailable")}</p>}
      {busy && <p className="admin-row-meta">{t("profilePhotoSaving")}</p>}
      {error && <p className="workflow-error">{error}</p>}
    </div>
  );
}
