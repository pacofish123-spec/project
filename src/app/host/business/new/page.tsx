"use client";

import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { useLanguage } from "@/lib/i18n";

export default function NewBusinessPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [message, setMessage] = useState("");
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/businesses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: values.name, slug: values.slug, description: values.description, city: values.city, countryCode: "DO" }) });
    const result = await response.json() as { business?: { id: string }; error?: string };
    if (response.ok && result.business) {
      router.push(`/host/cars/new?host=business&businessId=${result.business.id}`);
      return;
    }
    setMessage(result.error ?? t("hostBusinessError"));
  }
  return (
    <>
      <AppHeader />
      <main className="workflow-page has-photo" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?auto=format&fit=crop&w=1800&q=80)" }}>
      <div className="page-width">
        <div className="workflow-nav"><Link className="workflow-back" href="/host"><ArrowLeft size={16} /> {t("backLinkHostSetup")}</Link></div>
        <section className="workflow-card">
          <p className="workflow-kicker">{t("hostBusinessKicker")}</p>
          <h1>{t("hostBusinessTitleLine1")} <em>{t("hostBusinessTitleLine2")}</em></h1>
          <p className="workflow-intro">{t("hostBusinessIntro")}</p>
          {message && <p className="workflow-error">{message}</p>}
          <form className="workflow-form" onSubmit={handleSubmit}>
            <label>{t("hostBusinessNameLabel")}<input name="name" placeholder="Caribe Auto Rentals" required /></label>
            <label>{t("hostBusinessSlugLabel")}<input name="slug" placeholder="caribe-auto-rentals" pattern="[a-z0-9-]+" required /></label>
            <label>{t("cityLabel")}<input name="city" placeholder="Punta Cana" required /></label>
            <label>{t("hostBusinessDescLabel")}<textarea name="description" placeholder="Tell renters about your fleet and service." /></label>
            <button className="workflow-submit coral" type="submit"><Building2 size={17} /> {t("hostBusinessSubmit")}</button>
          </form>
        </section>
      </div>
      </main>
    </>
  );
}
