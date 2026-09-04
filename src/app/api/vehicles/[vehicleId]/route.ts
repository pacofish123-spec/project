import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/authorization";
import { decodeVin } from "@/lib/vin-decode";
import { attachTrustBadges } from "@/lib/vehicle-verification";

export async function GET(_request: Request, { params }: { params: Promise<{ vehicleId: string }> }) {
  try {
    const { vehicleId } = await params;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("vehicles").select("*").eq("id", vehicleId).maybeSingle();
    if (error || !data) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });

    // Same three-badge attach used everywhere a vehicle is listed
    // (search, homepage, destinations) — the detail page should never
    // claim a badge the card didn't.
    const [withBadges] = await attachTrustBadges(supabase, [data]);

    return NextResponse.json({ vehicle: withBadges });
  } catch {
    return NextResponse.json({ error: "Unable to load vehicle." }, { status: 500 });
  }
}

interface VehiclePatchInput {
  make?: string;
  model?: string;
  year?: number;
  locationCity?: string;
  countryCode?: string;
  dailyPrice?: number;
  baseCurrency?: string;
  transmission?: string;
  seats?: number;
  hasAc?: boolean;
  fuelPolicy?: string;
  cleaningPolicy?: string;
  smokingPolicy?: string;
  amenities?: string[];
  rentalTerms?: string[];
  photoPaths?: string[];
  latitude?: number;
  longitude?: number;
  vin?: string;
  // Only ever "paused" or "archived" here — going live requires the
  // verification-gated publish_vehicle RPC, not a plain field edit.
  status?: "draft" | "paused" | "archived";
}

const PATCHABLE_STATUSES = ["draft", "paused", "archived"];

// Handles two distinct callers: the "add photos" step right after
// creation (photoPaths/amenities only — see the note this used to
// carry) and the full vehicle-edit page (every listed field). Status,
// owner, business, and host_type are deliberately not editable here —
// those go through publish_vehicle/verification or aren't meant to
// change after creation at all.
export async function PATCH(request: Request, { params }: { params: Promise<{ vehicleId: string }> }) {
  try {
    const { vehicleId } = await params;
    const body = await request.json() as VehiclePatchInput;
    const { supabase } = await requireUser();

    const update: Record<string, unknown> = {};
    if (body.make !== undefined) update.make = body.make;
    if (body.model !== undefined) update.model = body.model;
    if (body.year !== undefined) update.year = body.year;
    if (body.locationCity !== undefined) update.location_city = body.locationCity;
    if (body.countryCode !== undefined) update.country_code = body.countryCode;
    if (body.dailyPrice !== undefined) update.daily_price = body.dailyPrice;
    if (body.baseCurrency !== undefined) update.base_currency = body.baseCurrency;
    if (body.transmission !== undefined) update.transmission = body.transmission;
    if (body.seats !== undefined) update.seats = body.seats;
    if (body.hasAc !== undefined) update.has_ac = body.hasAc;
    if (body.fuelPolicy !== undefined) update.fuel_policy = body.fuelPolicy;
    if (body.cleaningPolicy !== undefined) update.cleaning_policy = body.cleaningPolicy;
    if (body.smokingPolicy !== undefined) update.smoking_policy = body.smokingPolicy;
    if (body.amenities !== undefined) update.amenities = body.amenities;
    if (body.rentalTerms !== undefined) update.rental_terms = body.rentalTerms;
    if (body.photoPaths !== undefined) update.photo_paths = body.photoPaths;
    if (body.latitude !== undefined) update.latitude = body.latitude;
    if (body.longitude !== undefined) update.longitude = body.longitude;
    if (body.status !== undefined) {
      if (!PATCHABLE_STATUSES.includes(body.status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
      update.status = body.status;
    }
    if (body.vin !== undefined) {
      const vin = body.vin?.trim().toUpperCase() || null;
      update.vin = vin;
      if (vin) {
        // A VIN can be added/changed independently of the other fields
        // in this same PATCH — pull whatever isn't in this body from
        // the current row so the comparison is against the listing as
        // it will actually read once this save lands.
        const { data: current } = await supabase.from("vehicles").select("year, make, model, seats, transmission").eq("id", vehicleId).maybeSingle();
        const claim = {
          year: (update.year as number | undefined) ?? current?.year,
          make: (update.make as string | undefined) ?? current?.make,
          model: (update.model as string | undefined) ?? current?.model,
          seats: (update.seats as number | undefined) ?? current?.seats,
          transmission: (update.transmission as string | undefined) ?? current?.transmission,
        };
        const vinResult = claim.year && claim.make && claim.model ? await decodeVin(vin, claim as { year: number; make: string; model: string; seats?: number | null; transmission?: string | null }) : null;
        update.vin_verified = vinResult?.verified ?? false;
        update.vin_mismatches = vinResult?.mismatches ?? [];
        update.vin_decoded_at = vinResult?.ok ? new Date().toISOString() : null;
      } else {
        update.vin_verified = false;
        update.vin_mismatches = [];
        update.vin_decoded_at = null;
      }
    }
    if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

    const { data, error } = await supabase.from("vehicles").update(update).eq("id", vehicleId).select().maybeSingle();
    if (error) return NextResponse.json({ error: "Unable to update this vehicle." }, { status: 500 });
    if (!data) return NextResponse.json({ error: "You are not authorized to manage this vehicle." }, { status: 403 });

    return NextResponse.json({ vehicle: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to update this vehicle." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ vehicleId: string }> }) {
  try {
    const { vehicleId } = await params;
    const { supabase } = await requireUser();

    // Storage's own delete policy checks can_manage_vehicle(vehicle_id)
    // by looking the vehicle back up — which only works while the row
    // still exists. Clean up photos *before* deleting the row, not
    // after (deleting first then trying to clean up left photos
    // silently orphaned in storage, since the ownership check they
    // depend on would already be looking up a vehicle that's gone).
    const { data: existing } = await supabase.from("vehicles").select("photo_paths").eq("id", vehicleId).maybeSingle();
    if (existing?.photo_paths?.length) {
      await supabase.storage.from("vehicle-photos").remove(existing.photo_paths);
    }

    // Goes through the delete_vehicle RPC rather than a raw table
    // delete — it also clears this vehicle's own verification_records
    // first (an internal review artifact, safe to clear on an
    // authorized delete), which the RLS-bound client has no policy to
    // do directly. Bookings/reviews are untouched, so real trip
    // history still correctly blocks deletion below.
    const { error } = await supabase.rpc("delete_vehicle", { target_vehicle_id: vehicleId });

    if (error) {
      const reason = error.message ?? "";
      if (reason.includes("VEHICLE_ACCESS_DENIED")) return NextResponse.json({ error: "You are not authorized to manage this vehicle." }, { status: 403 });
      if (reason.includes("VEHICLE_NOT_FOUND")) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
      // Every booking/review FK to vehicles is ON DELETE RESTRICT (by
      // design — deleting a car shouldn't silently erase someone's
      // trip history). A listing with real history can't be
      // hard-deleted; archiving (status change) is the equivalent.
      if (error.code === "23503") {
        return NextResponse.json({ error: "This vehicle has real booking or review history and can't be deleted. Archive it instead to hide it from search." }, { status: 409 });
      }
      return NextResponse.json({ error: "Unable to delete this vehicle." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to delete this vehicle." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}
