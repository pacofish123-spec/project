"use client";

import { use, ChangeEvent, FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, Check, Gauge } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

interface Report {
  id: string;
  stage: "pickup" | "return";
  reported_by: string;
  fuel_level: number | null;
  mileage: number | null;
  notes: string | null;
  photo_paths: string[];
  acknowledged_by: string | null;
  acknowledged_at: string | null;
}

const MAX_PHOTO_BYTES = 50 * 1024 * 1024;

function PhotoGallery({ paths, stage }: { paths: string[]; stage: "pickup" | "return" }) {
  const { t } = useLanguage();
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    if (paths.length === 0) { queueMicrotask(() => setUrls([])); return; }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    Promise.all(paths.map((path) => supabase.storage.from("condition-reports").createSignedUrl(path, 3600))).then((results) => {
      setUrls(results.map((result) => result.data?.signedUrl).filter((url): url is string => Boolean(url)));
    });
  }, [paths]);

  if (urls.length === 0) return null;
  const stageLabel = stage === "pickup" ? t("conditionReportPickup") : t("conditionReportReturn");
  return (
    <div className="condition-photo-grid">
      {urls.map((url, index) => <a href={url} target="_blank" rel="noreferrer" key={url}><img src={url} alt={`${stageLabel} ${index + 1}`} /></a>)}
    </div>
  );
}

function StageCard({ bookingId, stage, report, selfId, onChange }: { bookingId: string; stage: "pickup" | "return"; report: Report | undefined; selfId: string | null; onChange: () => void }) {
  const { t } = useLanguage();
  const [fuelLevel, setFuelLevel] = useState(report?.fuel_level?.toString() ?? "");
  const [mileage, setMileage] = useState(report?.mileage?.toString() ?? "");
  const [notes, setNotes] = useState(report?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingPhotoPaths, setPendingPhotoPaths] = useState<string[]>([]);
  const [error, setError] = useState("");

  const isOwnReport = report && report.reported_by === selfId;
  const canEdit = !report || isOwnReport;

  async function handlePhotoSelect(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    setUploading(true);
    setError("");
    const uploaded: string[] = [];
    for (const file of files) {
      if (file.size > MAX_PHOTO_BYTES || !file.type.startsWith("image/")) continue;
      const path = `${bookingId}/${stage}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("condition-reports").upload(path, file);
      if (uploadError) continue;
      uploaded.push(path);
    }
    if (uploaded.length < files.length) setError(t("photoUploadError"));
    setPendingPhotoPaths((current) => [...current, ...uploaded]);
    setUploading(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    await fetch(`/api/bookings/${bookingId}/condition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stage,
        fuelLevel: fuelLevel ? Number(fuelLevel) : undefined,
        mileage: mileage ? Number(mileage) : undefined,
        notes: notes || undefined,
        photoPaths: pendingPhotoPaths.length > 0 ? [...(report?.photo_paths ?? []), ...pendingPhotoPaths] : undefined,
      }),
    });
    setBusy(false);
    setPendingPhotoPaths([]);
    onChange();
  }

  async function acknowledge() {
    if (!report) return;
    setBusy(true);
    await fetch(`/api/condition-reports/${report.id}/acknowledge`, { method: "POST" });
    setBusy(false);
    onChange();
  }

  return (
    <div className="workflow-card" style={{ marginBottom: 20 }}>
      <p className="workflow-kicker">{stage === "pickup" ? t("conditionReportPickup") : t("conditionReportReturn")}</p>
      {canEdit ? (
        <form className="workflow-form" onSubmit={handleSubmit}>
          <div className="field-grid">
            <label>{t("fuelLevelLabel")}<input type="number" min="0" max="100" value={fuelLevel} onChange={(event) => setFuelLevel(event.target.value)} /></label>
            <label>{t("mileageLabel")}<input type="number" min="0" value={mileage} onChange={(event) => setMileage(event.target.value)} /></label>
            <label className="full">{t("notesLabel")}<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          </div>
          <label className="photo-upload-dropzone compact" aria-disabled={uploading}>
            <Camera size={22} />
            <strong>{uploading ? t("uploadingPhotos") : t("addPhotosLabel")}</strong>
            <span>{t("photoUploadHint")}</span>
            <input type="file" accept="image/*" multiple hidden disabled={uploading} onChange={handlePhotoSelect} />
          </label>
          {pendingPhotoPaths.length > 0 && <p className="admin-row-meta">{pendingPhotoPaths.length} {t("addPhotosLabel").toLowerCase()}</p>}
          {error && <p className="workflow-error">{error}</p>}
          <PhotoGallery paths={report?.photo_paths ?? []} stage={stage} />
          <button className="workflow-submit coral" type="submit" disabled={busy || uploading}><Gauge size={16} /> {t("saveReport")}</button>
        </form>
      ) : (
        <div className="price-breakdown">
          <div><span>{t("fuelLevelLabel")}</span><span>{report?.fuel_level ?? "—"}%</span></div>
          <div><span>{t("mileageLabel")}</span><span>{report?.mileage ?? "—"}</span></div>
          {report?.notes && <div><span>{t("notesLabel")}</span><span>{report.notes}</span></div>}
        </div>
      )}
      {!canEdit && <PhotoGallery paths={report?.photo_paths ?? []} stage={stage} />}
      {report && !isOwnReport && (
        report.acknowledged_at
          ? <p className="admin-row-meta" style={{ marginTop: 12 }}><Check size={13} style={{ verticalAlign: "-2px" }} /> {t("reportAcknowledged")}</p>
          : <button className="workflow-link" type="button" style={{ marginTop: 12 }} disabled={busy} onClick={acknowledge}>{t("acknowledgeReport")}</button>
      )}
      {report && isOwnReport && !report.acknowledged_at && <p className="admin-row-meta" style={{ marginTop: 12 }}>{t("awaitingAcknowledgement")}</p>}
    </div>
  );
}

export default function ConditionReportPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = use(params);
  const { t } = useLanguage();
  const [reports, setReports] = useState<Report[]>([]);
  const [selfId, setSelfId] = useState<string | null>(null);

  function load() {
    fetch(`/api/bookings/${bookingId}/condition`).then(async (response) => {
      const result = await response.json() as { reports?: Report[] };
      if (response.ok) setReports(result.reports ?? []);
    }).catch(() => {});
  }

  useEffect(() => {
    load();
    createSupabaseBrowserClient()?.auth.getUser().then(({ data }) => setSelfId(data.user?.id ?? null));
  }, [bookingId]);

  const pickupReport = reports.find((report) => report.stage === "pickup");
  const returnReport = reports.find((report) => report.stage === "return");

  return (
    <main className="workflow-page">
      <div className="page-width">
        <div className="workflow-nav"><Link className="workflow-back" href="/trips"><ArrowLeft size={16} /> {t("backLinkBrowse")}</Link></div>
        <p className="workflow-kicker" style={{ marginBottom: 4 }}>{t("conditionReportTitle")}</p>
        <StageCard bookingId={bookingId} stage="pickup" report={pickupReport} selfId={selfId} onChange={load} />
        <StageCard bookingId={bookingId} stage="return" report={returnReport} selfId={selfId} onChange={load} />
      </div>
    </main>
  );
}
