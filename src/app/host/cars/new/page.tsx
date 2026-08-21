"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Camera, CarFront, MapPin, ShieldCheck } from "lucide-react";
import { ChangeEvent, FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { SelectField } from "@/components/select-field";
import { useLanguage } from "@/lib/i18n";
import { countries, supportedCurrencies } from "@/lib/marketplace-config";
import { vehicleMakes, modelsForMake, vehicleYears } from "@/lib/vehicle-catalog";
import { vehicleAmenities } from "@/lib/vehicle-amenities";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const MAX_PHOTO_BYTES = 50 * 1024 * 1024;
const OTHER_OPTION = "Other";

function PhotosStep({ vehicleId }: { vehicleId: string }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [error, setError] = useState("");

  async function handlePhotoSelect(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    setUploading(true);
    setError("");
    const uploadedPaths: string[] = [];
    const uploadedUrls: string[] = [];
    for (const file of files) {
      if (file.size > MAX_PHOTO_BYTES || !file.type.startsWith("image/")) continue;
      const path = `${vehicleId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("vehicle-photos").upload(path, file);
      if (uploadError) continue;
      uploadedPaths.push(path);
      uploadedUrls.push(supabase.storage.from("vehicle-photos").getPublicUrl(path).data.publicUrl);
    }
    if (uploadedPaths.length < files.length) setError(t("photoUploadError"));
    setPhotoPaths((current) => [...current, ...uploadedPaths]);
    setPreviewUrls((current) => [...current, ...uploadedUrls]);
    setUploading(false);
  }

  async function finish() {
    setSaving(true);
    if (photoPaths.length > 0) {
      await fetch(`/api/vehicles/${vehicleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoPaths }),
      });
      // Photos are the last thing a host would add before wanting a
      // review — auto-request verification here instead of making them
      // find "Request verification" again on a separate page. Fire-
      // and-forget: this is a nice-to-have, not something that should
      // block landing on the dashboard if it fails.
      fetch(`/api/vehicles/${vehicleId}/verification`, { method: "POST" }).catch(() => {});
    }
    router.push("/host/dashboard");
  }

  return (
    <>
      <AppHeader />
      <main className="workflow-page has-photo" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1800&q=80)" }}>
        <div className="page-width">
          <div className="workflow-nav"><Link className="workflow-back" href="/host/dashboard"><ArrowLeft size={16} /> {t("backLinkHostSetup")}</Link></div>
          <section className="workflow-card wide">
            <p className="workflow-kicker">{t("hostCarsPhotosKicker")}</p>
            <h1>{t("hostCarsPhotosTitle")}</h1>
            <p className="workflow-intro">{t("hostCarsPhotosIntro")}</p>
            <div className="step-row"><span className="active" /><span className="active" /></div>
            <label className="photo-upload-dropzone" aria-disabled={uploading}>
              <Camera size={26} />
              <strong>{uploading ? t("uploadingPhotos") : t("addPhotosLabel")}</strong>
              <span>{t("photoUploadHint")}</span>
              <input type="file" accept="image/*" multiple hidden disabled={uploading} onChange={handlePhotoSelect} />
            </label>
            {error && <p className="workflow-error">{error}</p>}
            {previewUrls.length > 0 && (
              <div className="condition-photo-grid">
                {previewUrls.map((url, index) => <a href={url} target="_blank" rel="noreferrer" key={url}><img src={url} alt={`Vehicle photo ${index + 1}`} /></a>)}
              </div>
            )}
            <div className="workflow-actions">
              <Link className="workflow-link" href="/host/dashboard">{t("hostCarsSkipPhotos")}</Link>
              <button className="workflow-submit coral" type="button" disabled={saving || uploading} onClick={finish}>
                {t("hostCarsGoToDashboard")} <ArrowRight size={16} />
              </button>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

function NewVehicleForm() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const hostType = searchParams.get("host") === "business" ? "business" : "individual";
  const businessId = searchParams.get("businessId") ?? "";

  // undefined = still checking, false = signed out, true = signed in
  const [signedIn, setSignedIn] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { queueMicrotask(() => setSignedIn(false)); return; }
    supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
  }, []);

  const [createdVehicleId, setCreatedVehicleId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [countryCode, setCountryCode] = useState(countries[0].code);
  const currencyOptions = countries.find((country) => country.code === countryCode)?.currencies ?? supportedCurrencies;

  const [make, setMake] = useState(vehicleMakes[0]);
  const [customMake, setCustomMake] = useState("");
  const models = modelsForMake(make);
  const modelOptions = [...models, OTHER_OPTION];
  const [model, setModel] = useState(modelOptions[0]);
  const [customModel, setCustomModel] = useState("");
  const years = vehicleYears();
  const [year, setYear] = useState(String(years[1] ?? years[0]));
  const [amenities, setAmenities] = useState<string[]>([]);

  function toggleAmenity(value: string) {
    setAmenities((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  }

  function chooseMake(nextMake: string) {
    setMake(nextMake);
    const nextModels = modelsForMake(nextMake);
    setModel([...nextModels, OTHER_OPTION][0]);
  }

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
      setMessage(t("hostCarsNoBusinessError"));
      return;
    }
    const finalMake = make === OTHER_OPTION ? customMake.trim() : make;
    const finalModel = model === OTHER_OPTION ? customModel.trim() : model;
    if (!finalMake || !finalModel) {
      setMessage(t("hostCarsGenericError"));
      return;
    }
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setSubmitting(true);
    const response = await fetch("/api/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hostType,
        businessId: hostType === "business" ? businessId : undefined,
        make: finalMake,
        model: finalModel,
        year: Number(year),
        locationCity: values.city,
        countryCode,
        dailyPrice: Number(values.price),
        baseCurrency: values.currency,
        transmission: values.transmission,
        seats: Number(values.seats),
        hasAc: values.hasAc === "on",
        fuelPolicy: values.fuelPolicy,
        cleaningPolicy: values.cleaningPolicy || undefined,
        amenities,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
      }),
    });
    const result = await response.json() as { vehicle?: { id: string }; error?: string };
    setSubmitting(false);
    if (response.ok && result.vehicle) {
      setCreatedVehicleId(result.vehicle.id);
    } else {
      setMessage(result.error ?? t("hostCarsGenericError"));
    }
  }

  if (signedIn === false) {
    return (
      <>
        <AppHeader />
        <main className="workflow-page">
          <div className="page-width">
            <div className="workflow-nav"><Link className="workflow-back" href="/host"><ArrowLeft size={16} /> {t("backLinkHostSetup")}</Link></div>
            <section className="workflow-card">
              <div className="dashboard-message"><ShieldCheck size={23} /><p>{t("hostCarsSignInRequiredBody")}</p></div>
              <Link className="workflow-submit coral" href="/sign-in"><ArrowRight size={16} />{t("signIn")}</Link>
            </section>
          </div>
        </main>
      </>
    );
  }

  if (createdVehicleId) return <PhotosStep vehicleId={createdVehicleId} />;

  return (
    <>
      <AppHeader />
      <main className="workflow-page has-photo" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1800&q=80)" }}>
      <div className="page-width">
        <div className="workflow-nav"><Link className="workflow-back" href="/host"><ArrowLeft size={16} /> {t("backLinkHostSetup")}</Link></div>
        <section className="workflow-card wide">
          <p className="workflow-kicker">{hostType === "business" ? t("hostCarsKickerBusiness") : t("hostCarsKickerPersonal")}</p>
          <h1>{t("hostCarsTitleLine1")} <em>{t("hostCarsTitleLine2")}</em></h1>
          <p className="workflow-intro">{hostType === "business" ? t("hostCarsIntroBusiness") : t("hostCarsIntroPersonal")}</p>
          <div className="step-row"><span className="active" /><span /></div>
          {hostType === "business" && !businessId && <p className="workflow-error">{t("hostCarsNoBusinessError")} <Link className="workflow-link" href="/host/business/new">{t("hostCarsCreateBusinessLink")}</Link></p>}
          {message && <p className="workflow-error">{message}</p>}
          <form className="workflow-form" onSubmit={handleSubmit}>
            <div className="field-grid">
              <SelectField key="make" name="make" label={t("makeLabel")} defaultValue={make} options={vehicleMakes.map((option) => ({ value: option, label: option === OTHER_OPTION ? t("makeOtherOption") : option }))} onChange={chooseMake} />
              {make === OTHER_OPTION && <label>{t("customMakeLabel")}<input value={customMake} onChange={(event) => setCustomMake(event.target.value)} required /></label>}
              <SelectField key={make} name="model" label={t("modelLabel")} defaultValue={modelOptions[0]} options={modelOptions.map((option) => ({ value: option, label: option === OTHER_OPTION ? t("modelOtherOption") : option }))} onChange={setModel} />
              {model === OTHER_OPTION && <label>{t("customModelLabel")}<input value={customModel} onChange={(event) => setCustomModel(event.target.value)} required /></label>}
              <SelectField key="year" name="year" label={t("yearLabel")} defaultValue={year} options={years.map((option) => ({ value: String(option), label: String(option) }))} onChange={setYear} />
              <label>{t("cityLabel")}<input name="city" placeholder="Santo Domingo" required /></label>
              <div className="full"><button className="workflow-link" type="button" disabled={locating} onClick={captureLocation}><MapPin size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />{coords ? t("locationCaptured") : t("useMyLocation")}</button></div>
              <SelectField name="country" label={t("countryLabel")} defaultValue={countryCode} options={countries.map((country) => ({ value: country.code, label: country.name }))} onChange={setCountryCode} />
              <label>{t("priceLabel")}<input name="price" type="number" min="1" required /></label>
              <SelectField key={countryCode} name="currency" label={t("currencyLabel")} defaultValue={currencyOptions[0]} options={currencyOptions.map((currency) => ({ value: currency, label: currency }))} />
              <SelectField name="transmission" label={t("transmissionLabel")} defaultValue="automatic" options={[{ value: "automatic", label: t("filterAutomatic") }, { value: "manual", label: "Manual" }]} />
              <label>{t("seatsLabel")}<input name="seats" type="number" min="1" max="99" defaultValue="5" required /></label>
              <SelectField name="fuelPolicy" label={t("fuelPolicyLabel")} defaultValue="full_to_full" options={[{ value: "full_to_full", label: t("fuelPolicyFull") }, { value: "as_delivered", label: t("fuelPolicyAsDelivered") }]} />
              <SelectField name="cleaningPolicy" label={t("cleaningPolicyLabel")} defaultValue="return_clean" options={[{ value: "return_clean", label: t("cleaningPolicyReturnClean") }, { value: "return_dirty_fee", label: t("cleaningPolicyReturnDirtyFee") }]} />
              <label className="full"><span><input name="hasAc" type="checkbox" /> {t("acLabel")}</span></label>
              <div className="full">
                <span className="select-label">{t("amenitiesLabel")}</span>
                <div className="amenity-grid">
                  {vehicleAmenities.map((amenity) => (
                    <label key={amenity.value}>
                      <input type="checkbox" checked={amenities.includes(amenity.value)} onChange={() => toggleAmenity(amenity.value)} />
                      {t(amenity.labelKey)}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <button className="workflow-submit coral" type="submit" disabled={submitting}><CarFront size={17} /> {t("hostCarsSubmit")} <ArrowRight size={16} /></button>
          </form>
        </section>
      </div>
      </main>
    </>
  );
}

export default function NewVehiclePage() {
  return <Suspense fallback={null}><NewVehicleForm /></Suspense>;
}
