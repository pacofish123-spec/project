"use client";

import Link from "next/link";
import { ArrowLeft, Camera, Save } from "lucide-react";
import { ChangeEvent, FormEvent, use, useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { SelectField } from "@/components/select-field";
import { useLanguage } from "@/lib/i18n";
import { countries, supportedCurrencies } from "@/lib/marketplace-config";
import { vehicleMakes, modelsForMake, vehicleYears } from "@/lib/vehicle-catalog";
import { vehicleAmenities } from "@/lib/vehicle-amenities";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { vehiclePhotoUrl } from "@/lib/storage-url";

const MAX_PHOTO_BYTES = 50 * 1024 * 1024;
const OTHER_OPTION = "Other";

interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  location_city: string;
  country_code: string;
  daily_price: number;
  base_currency: string;
  transmission?: string | null;
  seats?: number | null;
  has_ac?: boolean;
  fuel_policy?: string | null;
  cleaning_policy?: string | null;
  amenities?: string[] | null;
  photo_paths?: string[] | null;
}

export default function EditVehiclePage({ params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = use(params);
  const { t } = useLanguage();
  const [vehicle, setVehicle] = useState<Vehicle | null | undefined>(undefined);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [make, setMake] = useState("");
  const [customMake, setCustomMake] = useState("");
  const [model, setModel] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [year, setYear] = useState("");
  const [countryCode, setCountryCode] = useState(countries[0].code);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);

  useEffect(() => {
    fetch(`/api/vehicles/${vehicleId}`).then(async (response) => {
      const result = await response.json() as { vehicle?: Vehicle };
      const loaded = response.ok ? result.vehicle ?? null : null;
      setVehicle(loaded);
      if (loaded) {
        const knownMake = vehicleMakes.includes(loaded.make) ? loaded.make : OTHER_OPTION;
        setMake(knownMake);
        if (knownMake === OTHER_OPTION) setCustomMake(loaded.make);
        const models = modelsForMake(knownMake);
        const knownModel = models.includes(loaded.model) ? loaded.model : OTHER_OPTION;
        setModel(knownModel);
        if (knownModel === OTHER_OPTION) setCustomModel(loaded.model);
        setYear(String(loaded.year));
        setCountryCode(loaded.country_code);
        setAmenities(loaded.amenities ?? []);
        setPhotoPaths(loaded.photo_paths ?? []);
      }
    }).catch(() => setVehicle(null));
  }, [vehicleId]);

  const currencyOptions = countries.find((country) => country.code === countryCode)?.currencies ?? supportedCurrencies;
  const models = [...modelsForMake(make), OTHER_OPTION];

  function toggleAmenity(value: string) {
    setAmenities((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  }

  function chooseMake(nextMake: string) {
    setMake(nextMake);
    setModel([...modelsForMake(nextMake), OTHER_OPTION][0]);
  }

  async function handlePhotoSelect(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    setUploading(true);
    setMessage("");
    const uploaded: string[] = [];
    for (const file of files) {
      if (file.size > MAX_PHOTO_BYTES || !file.type.startsWith("image/")) continue;
      const path = `${vehicleId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("vehicle-photos").upload(path, file);
      if (uploadError) continue;
      uploaded.push(path);
    }
    if (uploaded.length < files.length) setMessage(t("photoUploadError"));
    const next = [...photoPaths, ...uploaded];
    setPhotoPaths(next);
    await fetch(`/api/vehicles/${vehicleId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photoPaths: next }) });
    setUploading(false);
  }

  async function removePhoto(path: string) {
    const supabase = createSupabaseBrowserClient();
    const next = photoPaths.filter((existing) => existing !== path);
    setPhotoPaths(next);
    await supabase?.storage.from("vehicle-photos").remove([path]);
    await fetch(`/api/vehicles/${vehicleId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photoPaths: next }) });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const finalMake = make === OTHER_OPTION ? customMake.trim() : make;
    const finalModel = model === OTHER_OPTION ? customModel.trim() : model;
    if (!finalMake || !finalModel) { setMessage(t("hostCarsGenericError")); return; }
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/vehicles/${vehicleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
        cleaningPolicy: values.cleaningPolicy,
        amenities,
      }),
    });
    const result = await response.json() as { error?: string };
    setSaving(false);
    setMessage(response.ok ? t("editVehicleSaved") : result.error ?? t("hostCarsGenericError"));
  }

  return (
    <>
      <AppHeader />
      <main className="workflow-page tint-wash-coral">
        <div className="page-width">
          <div className="workflow-nav"><Link className="workflow-back" href="/host/vehicles"><ArrowLeft size={16} /> {t("hostDashboardMyVehicles")}</Link></div>
          <section className="workflow-card wide">
            <p className="workflow-kicker">{t("editVehicleAction")}</p>
            {vehicle === undefined && <h1>{t("loadingVehicles")}</h1>}
            {vehicle === null && <p className="workflow-error">{t("searchNoResultsTitle")}</p>}
            {vehicle && (
              <>
                <h1>{vehicle.make} {vehicle.model}</h1>
                {message && <p className={message === t("editVehicleSaved") ? "workflow-success" : "workflow-error"}>{message}</p>}

                <p className="menu-kicker" style={{ margin: "24px 4px 10px" }}>{t("managePhotosHeading")}</p>
                <div className="condition-photo-grid">
                  {photoPaths.map((path) => (
                    <div key={path} style={{ position: "relative" }}>
                      <a href={vehiclePhotoUrl(path)} target="_blank" rel="noreferrer"><img src={vehiclePhotoUrl(path)} alt={`${vehicle.make} ${vehicle.model}`} /></a>
                      <button type="button" className="save-button saved" style={{ width: 26, height: 26 }} aria-label={t("removePhotoAction")} onClick={() => removePhoto(path)}>&times;</button>
                    </div>
                  ))}
                </div>
                <label className="photo-upload-dropzone compact" aria-disabled={uploading}>
                  <Camera size={20} />
                  <strong>{uploading ? t("uploadingPhotos") : t("addPhotosLabel")}</strong>
                  <span>{t("photoUploadHint")}</span>
                  <input type="file" accept="image/*" multiple hidden disabled={uploading} onChange={handlePhotoSelect} />
                </label>

                <form className="workflow-form" onSubmit={handleSubmit}>
                  <div className="field-grid">
                    <SelectField key="make" name="make" label={t("makeLabel")} defaultValue={make} options={vehicleMakes.map((option) => ({ value: option, label: option === OTHER_OPTION ? t("makeOtherOption") : option }))} onChange={chooseMake} />
                    {make === OTHER_OPTION && <label>{t("customMakeLabel")}<input value={customMake} onChange={(event) => setCustomMake(event.target.value)} required /></label>}
                    <SelectField key={`model-${make}`} name="model" label={t("modelLabel")} defaultValue={model} options={models.map((option) => ({ value: option, label: option === OTHER_OPTION ? t("modelOtherOption") : option }))} onChange={setModel} />
                    {model === OTHER_OPTION && <label>{t("customModelLabel")}<input value={customModel} onChange={(event) => setCustomModel(event.target.value)} required /></label>}
                    <SelectField key={`year-${year}`} name="year" label={t("yearLabel")} defaultValue={year} options={vehicleYears().map((option) => ({ value: String(option), label: String(option) }))} onChange={setYear} />
                    <label>{t("cityLabel")}<input name="city" defaultValue={vehicle.location_city} required /></label>
                    <SelectField key={`country-${countryCode}`} name="country" label={t("countryLabel")} defaultValue={countryCode} options={countries.map((country) => ({ value: country.code, label: country.name }))} onChange={setCountryCode} />
                    <label>{t("priceLabel")}<input name="price" type="number" min="1" defaultValue={vehicle.daily_price} required /></label>
                    <SelectField key={`currency-${countryCode}`} name="currency" label={t("currencyLabel")} defaultValue={vehicle.base_currency} options={currencyOptions.map((currency) => ({ value: currency, label: currency }))} />
                    <SelectField name="transmission" label={t("transmissionLabel")} defaultValue={vehicle.transmission ?? "automatic"} options={[{ value: "automatic", label: t("filterAutomatic") }, { value: "manual", label: "Manual" }]} />
                    <label>{t("seatsLabel")}<input name="seats" type="number" min="1" max="99" defaultValue={vehicle.seats ?? 5} required /></label>
                    <SelectField name="fuelPolicy" label={t("fuelPolicyLabel")} defaultValue={vehicle.fuel_policy ?? "full_to_full"} options={[{ value: "full_to_full", label: t("fuelPolicyFull") }, { value: "as_delivered", label: t("fuelPolicyAsDelivered") }]} />
                    <SelectField name="cleaningPolicy" label={t("cleaningPolicyLabel")} defaultValue={vehicle.cleaning_policy ?? "return_clean"} options={[{ value: "return_clean", label: t("cleaningPolicyReturnClean") }, { value: "return_dirty_fee", label: t("cleaningPolicyReturnDirtyFee") }]} />
                    <label className="full"><span><input name="hasAc" type="checkbox" defaultChecked={vehicle.has_ac} /> {t("acLabel")}</span></label>
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
                  <button className="workflow-submit coral" type="submit" disabled={saving}><Save size={17} /> {saving ? t("editVehicleSaving") : t("editVehicleSaveAction")}</button>
                </form>
              </>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
