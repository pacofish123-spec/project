"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, CarFront, MapPin } from "lucide-react";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { SelectField } from "@/components/select-field";
import { useLanguage } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";
import { countries, supportedCurrencies } from "@/lib/marketplace-config";

function NewVehicleForm() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const hostType = searchParams.get("host") === "business" ? "business" : "individual";
  const businessId = searchParams.get("businessId") ?? "";
  const [message, setMessage] = useState("");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [countryCode, setCountryCode] = useState(countries[0].code);
  const currencyOptions = countries.find((country) => country.code === countryCode)?.currencies ?? supportedCurrencies;

  function captureLocation() {
    if (!navigator.geolocation) { setMessage(t("locationDenied")); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => { setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude }); setLocating(false); },
      () => { setMessage(t("locationDenied")); setLocating(false); },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (hostType === "business" && !businessId) {
      setMessage(`${t("hostCarsNoBusinessError")}`);
      return;
    }
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hostType,
        businessId: hostType === "business" ? businessId : undefined,
        make: values.make,
        model: values.model,
        year: Number(values.year),
        locationCity: values.city,
        countryCode,
        dailyPrice: Number(values.price),
        baseCurrency: values.currency,
        transmission: values.transmission,
        seats: Number(values.seats),
        hasAc: values.hasAc === "on",
        fuelPolicy: values.fuelPolicy,
        cleaningPolicy: values.cleaningPolicy || undefined,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
      }),
    });
    const result = await response.json() as { error?: string };
    setMessage(response.ok ? t("hostCarsSuccess") : result.error ?? t("hostCarsGenericError"));
  }

  return (
    <main className="workflow-page">
      <div className="page-width">
        <div className="workflow-nav"><Link className="workflow-back" href="/host"><ArrowLeft size={16} /> {t("backLinkHostSetup")}</Link><ThemeToggle /></div>
        <section className="workflow-card wide">
          <p className="workflow-kicker">{hostType === "business" ? t("hostCarsKickerBusiness") : t("hostCarsKickerPersonal")}</p>
          <h1>{t("hostCarsTitleLine1")} <em>{t("hostCarsTitleLine2")}</em></h1>
          <p className="workflow-intro">{hostType === "business" ? t("hostCarsIntroBusiness") : t("hostCarsIntroPersonal")}</p>
          <div className="step-row"><span className="active" /><span /><span /><span /></div>
          {hostType === "business" && !businessId && <p className="workflow-error">{t("hostCarsNoBusinessError")} <Link className="workflow-link" href="/host/business/new">{t("hostCarsCreateBusinessLink")}</Link></p>}
          {message && <p className={message === t("hostCarsSuccess") ? "workflow-success" : "workflow-error"}>{message}</p>}
          <form className="workflow-form" onSubmit={handleSubmit}>
            <div className="field-grid">
              <label>{t("makeLabel")}<input name="make" placeholder="Toyota" required /></label>
              <label>{t("modelLabel")}<input name="model" placeholder="Corolla" required /></label>
              <label>{t("yearLabel")}<input name="year" type="number" min="1886" max="2200" required /></label>
              <label>{t("cityLabel")}<input name="city" placeholder="Santo Domingo" required /></label>
              <div className="full"><button className="workflow-link" type="button" disabled={locating} onClick={captureLocation}><MapPin size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />{coords ? t("locationCaptured") : t("useMyLocation")}</button></div>
              <SelectField name="country" label={t("countryLabel")} defaultValue={countryCode} options={countries.map((country) => ({ value: country.code, label: country.name }))} onChange={setCountryCode} />
              <label>{t("priceLabel")}<input name="price" type="number" min="1" required /></label>
              <SelectField key={countryCode} name="currency" label={t("currencyLabel")} defaultValue={currencyOptions[0]} options={currencyOptions.map((currency) => ({ value: currency, label: currency }))} />
              <SelectField name="transmission" label={t("transmissionLabel")} defaultValue="automatic" options={[{ value: "automatic", label: t("filterAutomatic") }, { value: "manual", label: "Manual" }]} />
              <label>{t("seatsLabel")}<input name="seats" type="number" min="1" max="99" defaultValue="5" required /></label>
              <SelectField name="fuelPolicy" label={t("fuelPolicyLabel")} defaultValue="full_to_full" options={[{ value: "full_to_full", label: t("fuelPolicyFull") }, { value: "as_delivered", label: t("fuelPolicyAsDelivered") }]} />
              <label className="full">{t("cleaningPolicyLabel")}<input name="cleaningPolicy" placeholder={t("cleaningPolicyPlaceholder")} /></label>
              <label className="full"><span><input name="hasAc" type="checkbox" /> {t("acLabel")}</span></label>
            </div>
            <button className="workflow-submit coral" type="submit"><CarFront size={17} /> {t("hostCarsSubmit")} <ArrowRight size={16} /></button>
          </form>
          <div className="workflow-lang-bar"><LanguageSwitcher /></div>
        </section>
      </div>
    </main>
  );
}

export default function NewVehiclePage() {
  return <Suspense fallback={null}><NewVehicleForm /></Suspense>;
}
