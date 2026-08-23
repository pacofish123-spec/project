"use client";

import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";

interface PlatformSettings {
  insurance_waiver_enabled: boolean;
  insurance_waiver_daily_rate: number | null;
  insurance_waiver_currency: string;
  cdc_membership_enabled: boolean;
}

// The first admin-editable platform-wide rate — everything else (tax,
// platform fee) is still a hardcoded constant in the pricing RPCs, on
// purpose (see migration 0043's comment). This one has to be editable
// because the actual number doesn't exist yet: it's set by whichever
// insurance company yoRento signs, not by this codebase.
export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [message, setMessage] = useState("Loading settings...");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings").then(async (response) => {
      const result = await response.json() as { settings?: PlatformSettings; error?: string };
      if (!response.ok || !result.settings) { setMessage(result.error ?? "Unable to load settings."); return; }
      setSettings(result.settings);
      setMessage("");
    }).catch(() => setMessage("Unable to load settings."));
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        insuranceWaiverEnabled: settings.insurance_waiver_enabled,
        insuranceWaiverDailyRate: settings.insurance_waiver_daily_rate,
        insuranceWaiverCurrency: settings.insurance_waiver_currency,
        cdcMembershipEnabled: settings.cdc_membership_enabled,
      }),
    });
    const result = await response.json().catch(() => ({})) as { settings?: PlatformSettings; error?: string };
    setSaving(false);
    if (!response.ok || !result.settings) { setMessage(result.error ?? "Unable to save settings."); return; }
    setSettings(result.settings);
    setMessage("Saved.");
  }

  if (!settings) {
    return (
      <section className="workflow-card wide requests-card">
        <p className="workflow-kicker">Platform settings</p>
        <div className="dashboard-message"><Settings2 size={22} /><p>{message}</p></div>
      </section>
    );
  }

  return (
    <section className="workflow-card wide requests-card">
      <p className="workflow-kicker">Platform settings</p>

      <div className="admin-settings-block">
        <h3>Damage waiver (insurance)</h3>
        <p className="admin-row-meta">
          At pay time, a renter can choose this waiver fee instead of the $300 refundable deposit. Off and hidden
          until an actual rate exists — nothing renders to renters while disabled, regardless of the rate below.
        </p>
        <label className="review-consent-row">
          <input
            type="checkbox"
            checked={settings.insurance_waiver_enabled}
            onChange={(event) => setSettings({ ...settings, insurance_waiver_enabled: event.target.checked })}
          />
          Enabled — show the waiver option to renters
        </label>
        <label className="rate-currency-label">
          Daily rate
          <div className="rate-currency-row">
            <input
              type="number"
              min={0}
              step="0.01"
              value={settings.insurance_waiver_daily_rate ?? ""}
              onChange={(event) => setSettings({ ...settings, insurance_waiver_daily_rate: event.target.value === "" ? null : Number(event.target.value) })}
              placeholder="e.g. 8.00"
            />
            <input
              type="text"
              className="currency-code-input"
              value={settings.insurance_waiver_currency}
              maxLength={3}
              aria-label="Currency"
              onChange={(event) => setSettings({ ...settings, insurance_waiver_currency: event.target.value.toUpperCase() })}
            />
          </div>
        </label>
      </div>

      <div className="admin-settings-block">
        <h3>Casa del Conductor</h3>
        <p className="admin-row-meta">
          Gates the CDC listing badge and Trust page section. Leave off until the bulk membership deal is actually signed.
        </p>
        <label className="review-consent-row">
          <input
            type="checkbox"
            checked={settings.cdc_membership_enabled}
            onChange={(event) => setSettings({ ...settings, cdc_membership_enabled: event.target.checked })}
          />
          Enabled — show the CDC badge and Trust section
        </label>
      </div>

      {message && <p className={message === "Saved." ? "workflow-success" : "workflow-error"}>{message}</p>}
      <button className="workflow-submit coral" type="button" disabled={saving} onClick={save} style={{ marginTop: 10 }}>
        {saving ? "Saving..." : "Save settings"}
      </button>
    </section>
  );
}
