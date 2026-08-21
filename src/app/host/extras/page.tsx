"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Package, Plus } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { useLanguage } from "@/lib/i18n";
import { formatMoney } from "@/lib/format";

interface Extra {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  inventory_count: number | null;
  active: boolean;
}

export default function HostExtrasPage() {
  const { t } = useLanguage();
  const [extras, setExtras] = useState<Extra[] | null>(null);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");

  function load() {
    fetch("/api/extras").then(async (response) => {
      const result = await response.json() as { extras?: Extra[]; error?: string };
      if (!response.ok) { setMessage(result.error ?? ""); return; }
      setExtras(result.extras ?? []);
    }).catch(() => setMessage("Unable to load extras."));
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const inventoryRaw = String(form.get("inventoryCount") || "").trim();
    const response = await fetch("/api/extras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        description: form.get("description") || undefined,
        price: Number(form.get("price")),
        currency: form.get("currency") || "DOP",
        inventoryCount: inventoryRaw ? Number(inventoryRaw) : null,
      }),
    });
    if (response.ok) { (event.target as HTMLFormElement).reset(); load(); }
  }

  async function toggleActive(extra: Extra) {
    setBusyId(extra.id);
    const response = await fetch(`/api/extras/${extra.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !extra.active }) });
    if (response.ok) load();
    setBusyId("");
  }

  async function remove(extraId: string) {
    setBusyId(extraId);
    const response = await fetch(`/api/extras/${extraId}`, { method: "DELETE" });
    if (response.ok) load();
    setBusyId("");
  }

  return (
    <>
      <AppHeader />
      <main className="workflow-page tint-wash-coral">
      <div className="page-width">
        <div className="workflow-nav"><Link className="workflow-back" href="/host/dashboard"><ArrowLeft size={16} /> {t("backLinkHostSetup")}</Link></div>
        <section className="workflow-card wide">
          <p className="workflow-kicker">{t("hostExtrasKicker")}</p>
          <h1>{t("hostExtrasTitle")}</h1>
          <p className="workflow-intro">{t("hostExtrasIntro")}</p>

          <form className="workflow-form" onSubmit={handleSubmit}>
            <div className="field-grid">
              <label>{t("extraNameLabel")}<input name="name" placeholder="Beach chairs (2)" required /></label>
              <label>{t("extraPriceLabel")}<input name="price" type="number" min="0" step="0.01" required /></label>
              <label>{t("currencyLabel")}<input name="currency" defaultValue="DOP" /></label>
              <label>{t("extraInventoryLabel")} <span className="field-hint">{t("extraInventoryHint")}</span><input name="inventoryCount" type="number" min="0" /></label>
              <label className="full">{t("extraDescriptionLabel")}<textarea name="description" placeholder="2 beach chairs, folding, delivered with the car." /></label>
            </div>
            <button className="workflow-submit coral" type="submit"><Plus size={17} /> {t("createExtraSubmit")}</button>
          </form>

          {message && <p className="workflow-error" style={{ marginTop: 20 }}>{message}</p>}

          {extras && extras.length === 0 && <p className="admin-row-meta" style={{ marginTop: 20 }}>{t("noExtrasYet")}</p>}

          {extras && extras.length > 0 && (
            <div className="trip-list" style={{ marginTop: 24 }}>
              {extras.map((extra) => (
                <article className="trip-card" key={extra.id}>
                  <div>
                    <strong><Package size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />{extra.name}</strong>
                    <span className="trip-status">{extra.active ? t("extraActiveToggleOn") : t("extraActiveToggleOff")}</span>
                  </div>
                  {extra.description && <p className="admin-row-meta">{extra.description}</p>}
                  <div className="trip-footer">
                    <strong>{formatMoney(extra.price, extra.currency)}{extra.inventory_count !== null ? ` · ${extra.inventory_count}` : ""}</strong>
                    <div className="trip-actions">
                      <button className="workflow-link" type="button" disabled={busyId === extra.id} onClick={() => toggleActive(extra)}>{extra.active ? t("extraActiveToggleOff") : t("extraActiveToggleOn")}</button>
                      <button className="workflow-link" type="button" disabled={busyId === extra.id} onClick={() => remove(extra.id)}>{t("removeExtra")}</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          <div className="workflow-actions" style={{ marginTop: 24 }}>
            <Link className="workflow-link" href="/host/dashboard">{t("backLinkHostSetup")} <ArrowRight size={14} /></Link>
          </div>
        </section>
      </div>
      </main>
    </>
  );
}
