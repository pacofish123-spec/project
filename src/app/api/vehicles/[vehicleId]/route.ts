import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/authorization";

export async function GET(_request: Request, { params }: { params: Promise<{ vehicleId: string }> }) {
  try {
    const { vehicleId } = await params;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("vehicles").select("*").eq("id", vehicleId).maybeSingle();
    if (error || !data) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });

    const { data: verificationRecord } = await supabase
      .from("verification_records")
      .select("id")
      .eq("vehicle_id", vehicleId)
      .eq("verification_type", "vehicle")
      .eq("status", "verified")
      .maybeSingle();

    return NextResponse.json({ vehicle: { ...data, verified: Boolean(verificationRecord) } });
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
  amenities?: string[];
  photoPaths?: string[];
  latitude?: number;
  longitude?: number;
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
    if (body.amenities !== undefined) update.amenities = body.amenities;
    if (body.photoPaths !== undefined) update.photo_paths = body.photoPaths;
    if (body.latitude !== undefined) update.latitude = body.latitude;
    if (body.longitude !== undefined) update.longitude = body.longitude;
    if (body.status !== undefined) {
      if (!PATCHABLE_STATUSES.includes(body.status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
      update.status = body.status;
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

    const { data, error } = await supabase.from("vehicles").delete().eq("id", vehicleId).select("id, photo_paths").maybeSingle();

    if (error) {
      // Every booking/extras/verification FK to vehicles is ON DELETE
      // RESTRICT (by design — deleting a car shouldn't silently erase
      // someone's trip history). A listing with any real history can't
      // be hard-deleted; archiving (status change) is the equivalent.
      if (error.code === "23503") {
        return NextResponse.json({ error: "This vehicle has booking or verification history and can't be deleted. Archive it instead to hide it from search." }, { status: 409 });
      }
      return NextResponse.json({ error: "Unable to delete this vehicle." }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: "You are not authorized to manage this vehicle." }, { status: 403 });

    if (data.photo_paths?.length) {
      await supabase.storage.from("vehicle-photos").remove(data.photo_paths);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to delete this vehicle." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}
