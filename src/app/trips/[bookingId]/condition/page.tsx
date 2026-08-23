"use client";

import { use, ChangeEvent, FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, Check, Gauge } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { CONDITION_REPORT_SHOT_KEYS, type ConditionReportShot, type ConditionReportShotKey } from "@/lib/condition-report-shots";
import type { TranslationKey } from "@/lib/translations";

interface Report {
  id: string;
  stage: "pickup" | "return";
  reported_by: string;
  fuel_level: number | null;
  mileage: number | null;
  notes: string | null;
  photo_paths: string[];
  shots?: Partial<Record<ConditionReportShotKey, ConditionReportShot>>;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
}

const MAX_PHOTO_BYTES = 50 * 1024 * 1024;

const shotLabelKey: Record<ConditionReportShotKey, TranslationKey> = {
  front: "shotLabelFront",
  back: "shotLabelBack",
  left: "shotLabelLeft",
  right: "shotLabelRight",
  interior_front: "shotLabelInteriorFront",
  interior_rear: "shotLabelInteriorRear",
  odometer: "shotLabelOdometer",
  tyre_tread: "shotLabelTyreTread",
};

// Stored as the same 0-100 integer column it always was — just picked
// from a fuel-gauge-shaped set of stops instead of typed as a raw
// number nobody reads a fuel needle in anyway.
const fuelLevelOptions = [
  { value: 0, label: "E" },
  { value: 25, label: "¼" },
  { value: 50, label: "½" },
  { value: 75, label: "¾" },
  { value: 100, label: "F" },
];

function fuelLevelDisplay(value: number | null | undefined): string {
  if (value == null) return "—";
  const closest = fuelLevelOptions.reduce((best, option) => (Math.abs(option.value - value) < Math.abs(best.value - value) ? option : best));
  return closest.label;
}

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
  const [uploadingShot, setUploadingShot] = useState<ConditionReportShotKey | "">("");
  const [shots, setShots] = useState<Partial<Record<ConditionReportShotKey, ConditionReportShot>>>(report?.shots ?? {});
  const [error, setError] = useState("");

  const isOwnReport = report && report.reported_by === selfId;
  const canEdit = !report || isOwnReport;
  const allShotsCaptured = CONDITION_REPORT_SHOT_KEYS.every((key) => shots[key]?.path);

  // One labeled slot at a time, not a bulk multi-upload — a fixed
  // sequence is the whole point of the guided capture (wedge 03): no
  // renter/host can submit a return report with three angles of the
  // dashboard and nothing else.
  async function handleShotSelect(key: ConditionReportShotKey, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_PHOTO_BYTES || !file.type.startsWith("image/")) { setError(t("photoUploadError")); return; }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    setUploadingShot(key);
    setError("");
    const path = `${bookingId}/${stage}/${key}-${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("condition-reports").upload(path, file);
    setUploadingShot("");
    if (uploadError) { setError(t("photoUploadError")); return; }
    // capturedAt is read at file-select time, client-side — the point
    // is a timestamp tied to the moment the shot was taken, not to
    // whenever the whole report eventually gets saved.
    setShots((current) => ({ ...current, [key]: { path, capturedAt: new Date().toISOString() } }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!allShotsCaptured) { setError(t("conditionReportShotsRequired")); return; }
    setBusy(true);
    setError("");
    const response = await fetch(`/api/bookings/${bookingId}/condition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stage,
        fuelLevel: fuelLevel ? Number(fuelLevel) : undefined,
        mileage: mileage ? Number(mileage) : undefined,
        notes: notes || undefined,
        photoPaths: CONDITION_REPORT_SHOT_KEYS.map((key) => shots[key]?.path).filter((path): path is string => Boolean(path)),
        shots,
        finalize: true,
      }),
    });
    setBusy(false);
    if (!response.ok) {
      const result = await response.json().catch(() => ({})) as { error?: string };
      setError(result.error ?? t("conditionReportSaveError"));
      return;
    }
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
            <div className="full">
              <span className="select-label">{t("fuelLevelLabel")}</span>
              <div className="fuel-level-picker">
                {fuelLevelOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`fuel-level-option ${Number(fuelLevel) === option.value ? "active" : ""}`}
                    onClick={() => setFuelLevel(String(option.value))}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <label>{t("mileageLabel")}<input type="number" min="0" value={mileage} onChange={(event) => setMileage(event.target.value)} /></label>
            <label className="full">{t("notesLabel")}<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          </div>
          <div className="full">
            <span className="select-label">{t("conditionReportShotsLabel")}</span>
            <div className="shot-capture-grid">
              {CONDITION_REPORT_SHOT_KEYS.map((key) => {
                const captured = shots[key];
                const busyHere = uploadingShot === key;
                return (
                  <label key={key} className={`shot-capture-slot ${captured ? "captured" : ""}`} aria-disabled={busyHere}>
                    {captured ? <Check size={20} /> : <Camera size={20} />}
                    <strong>{t(shotLabelKey[key])}</strong>
                    <span>{busyHere ? t("uploadingPhotos") : captured ? t("shotCapturedLabel") : t("shotPendingLabel")}</span>
                    <input type="file" accept="image/*" capture="environment" hidden disabled={busyHere} onChange={(event) => handleShotSelect(key, event)} />
                  </label>
                );
              })}
            </div>
          </div>
          {error && <p className="workflow-error">{error}</p>}
          <PhotoGallery paths={report?.photo_paths ?? []} stage={stage} />
          <button className="workflow-submit coral" type="submit" disabled={busy || Boolean(uploadingShot) || !allShotsCaptured}><Gauge size={16} /> {t("saveReport")}</button>
        </form>
      ) : (
        <div className="price-breakdown">
          <div><span>{t("fuelLevelLabel")}</span><span>{fuelLevelDisplay(report?.fuel_level)}</span></div>
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
    <main className="workflow-page tint-wash-coral">
      <div className="page-width">
        <div className="workflow-nav"><Link className="workflow-back" href="/trips"><ArrowLeft size={16} /> {t("backLinkBrowse")}</Link></div>
        <p className="workflow-kicker" style={{ marginBottom: 4 }}>{t("conditionReportTitle")}</p>
        <StageCard bookingId={bookingId} stage="pickup" report={pickupReport} selfId={selfId} onChange={load} />
        <StageCard bookingId={bookingId} stage="return" report={returnReport} selfId={selfId} onChange={load} />
      </div>
    </main>
  );
}
