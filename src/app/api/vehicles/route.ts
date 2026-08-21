import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { attachTrustBadges } from "@/lib/vehicle-verification";

interface VehicleInput {
  hostType?: "individual" | "business";
  businessId?: string;
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
  rentalTerms?: string[];
  latitude?: number;
  longitude?: number;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hostType = searchParams.get("hostType");
  const city = searchParams.get("city");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const transmission = searchParams.get("transmission");
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");
  const seats = searchParams.get("seats");
  const rentalTerm = searchParams.get("rentalTerm");
  try {
    const supabase = await createSupabaseServerClient();

    // The date-conflict lookup and the geo-distance RPC are independent
    // of each other — a search with both dates and a location previously
    // paid for two round trips in sequence for no reason.
    const startsAt = startDate ? new Date(startDate) : null;
    const endsAt = endDate ? new Date(endDate) : null;
    const datesValid = Boolean(startsAt && endsAt && Number.isFinite(startsAt.getTime()) && Number.isFinite(endsAt.getTime()) && endsAt > startsAt);
    const originLat = lat ? Number(lat) : null;
    const originLng = lng ? Number(lng) : null;
    const coordsValid = Boolean(originLat !== null && originLng !== null && Number.isFinite(originLat) && Number.isFinite(originLng));

    const [conflictsResult, distancesResult] = await Promise.all([
      // public_booking_availability(), not the bookings table directly —
      // bookings' own RLS only lets a participant read their own rows,
      // so this query returned nothing for a signed-out visitor (or
      // anyone not party to the conflicting booking) and silently never
      // filtered anything out for them. The function exposes just enough
      // (vehicle + date range) to compute conflicts, to every role — a
      // SECURITY DEFINER function rather than a security-definer view,
      // so it doesn't need bookings' own broader column grants touched.
      datesValid
        ? supabase.rpc("public_booking_availability").select("vehicle_id").lt("starts_at", endsAt!.toISOString()).gt("ends_at", startsAt!.toISOString())
        : Promise.resolve({ data: null }),
      coordsValid
        ? supabase.rpc("vehicles_with_distance", { origin_lat: originLat, origin_lng: originLng })
        : Promise.resolve({ data: null }),
    ]);

    const excludedVehicleIds = [...new Set(((conflictsResult.data ?? []) as Array<{ vehicle_id: string }>).map((booking) => booking.vehicle_id))];
    const distanceByVehicle = new Map((distancesResult.data ?? []).map((row: { id: string; distance_km: number }) => [row.id, row.distance_km]));

    let query = supabase.from("vehicles").select("*").eq("status", "published");
    if (hostType === "individual" || hostType === "business") query = query.eq("host_type", hostType);
    if (city) query = query.ilike("location_city", `%${city}%`);
    if (transmission) query = query.eq("transmission", transmission);
    if (minPrice && Number.isFinite(Number(minPrice))) query = query.gte("daily_price", Number(minPrice));
    if (maxPrice && Number.isFinite(Number(maxPrice))) query = query.lte("daily_price", Number(maxPrice));
    if (seats && Number.isFinite(Number(seats))) query = query.gte("seats", Number(seats));
    if (rentalTerm) query = query.contains("rental_terms", [rentalTerm]);
    if (excludedVehicleIds.length) query = query.not("id", "in", `(${excludedVehicleIds.join(",")})`);

    const { data, error } = await query.order("promoted", { ascending: false }).order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: "Unable to load vehicles." }, { status: 500 });

    let vehicles = (data ?? []).map((vehicle) => ({ ...vehicle, distance_km: distanceByVehicle.get(vehicle.id) ?? null }));
    if (distanceByVehicle.size) {
      vehicles = vehicles
        .filter((vehicle) => vehicle.distance_km !== null)
        .sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));
    }

    const vehiclesWithVerification = await attachTrustBadges(supabase, vehicles);

    return NextResponse.json({ vehicles: vehiclesWithVerification });
  } catch {
    return NextResponse.json({ error: "Marketplace data is not configured yet." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as VehicleInput;
    const hostType = body.hostType;
    if (!hostType || !body.make || !body.model || !body.year || !body.locationCity || !body.dailyPrice) {
      return NextResponse.json({ error: "Required vehicle details are missing." }, { status: 400 });
    }

    const { supabase, user } = hostType === "individual"
      ? await requireCapability("can_host_personally")
      : await requireCapability("can_host_for_business");

    if (hostType === "business") {
      if (!body.businessId) return NextResponse.json({ error: "A business is required for a business vehicle." }, { status: 400 });
      const { data: membership } = await supabase.from("business_members").select("business_id").eq("business_id", body.businessId).eq("user_id", user.id).maybeSingle();
      if (!membership) return NextResponse.json({ error: "You are not authorized to list for this business." }, { status: 403 });
    }

    const { data, error } = await supabase.from("vehicles").insert({
      owner_user_id: user.id,
      business_id: hostType === "business" ? body.businessId : null,
      host_type: hostType,
      make: body.make,
      model: body.model,
      year: body.year,
      location_city: body.locationCity,
      country_code: body.countryCode ?? "DO",
      daily_price: body.dailyPrice,
      base_currency: body.baseCurrency ?? "DOP",
      transmission: body.transmission,
      seats: body.seats,
      has_ac: body.hasAc ?? false,
      fuel_policy: body.fuelPolicy ?? null,
      cleaning_policy: body.cleaningPolicy ?? null,
      amenities: body.amenities ?? [],
      rental_terms: body.rentalTerms ?? [],
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      status: "draft",
    }).select().single();

    if (error) {
      console.error("POST /api/vehicles insert error:", error);
      return NextResponse.json({ error: "Unable to create vehicle." }, { status: 500 });
    }
    return NextResponse.json({ vehicle: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "CAPABILITY_REQUIRED" ? 403 : 500;
    if (status === 500) console.error("POST /api/vehicles error:", error);
    return NextResponse.json({ error: status === 401 ? "Sign in to list a vehicle." : status === 403 ? "You're not authorized to list a vehicle here." : "Unable to create vehicle." }, { status });
  }
}