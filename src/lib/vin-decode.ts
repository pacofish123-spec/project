// Free, keyless NHTSA vPIC VIN decoder — no account, no credentials,
// no rate-limit documented for reasonable use. Used at listing
// create/edit time to catch exactly the class of bug the wedge audit
// found live (a BMW E30 listed seating two, priced above a 2024 Kia
// Sorento): year/make/model are decoded reliably; seats/transmission
// are decoded best-effort — vPIC often leaves them blank, so those are
// only ever flagged when NHTSA actually returned a value that differs.
interface VinDecodeResult {
  ok: boolean;
  verified: boolean;
  mismatches: string[];
  decoded: { year?: string; make?: string; model?: string; seats?: string; transmission?: string };
}

interface ListingClaim {
  year: number;
  make: string;
  model: string;
  seats?: number | null;
  transmission?: string | null;
}

function normalize(value: string | undefined | null): string {
  return (value ?? "").trim().toLowerCase();
}

export async function decodeVin(vin: string, claim: ListingClaim): Promise<VinDecodeResult> {
  const empty: VinDecodeResult = { ok: false, verified: false, mismatches: [], decoded: {} };
  if (!vin || vin.length !== 17) return empty;

  let response: Response;
  try {
    response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${encodeURIComponent(vin)}?format=json`, {
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return empty; // Network hiccup / NHTSA down — never blocks the listing save, just skips verification.
  }
  if (!response.ok) return empty;

  const body = await response.json().catch(() => null) as { Results?: Array<Record<string, string>> } | null;
  const row = body?.Results?.[0];
  if (!row || (!row.Make && !row.Model && !row.ModelYear)) return empty;

  const decoded = {
    year: row.ModelYear || undefined,
    make: row.Make || undefined,
    model: row.Model || undefined,
    seats: row.Seats || undefined,
    transmission: row.TransmissionStyle || undefined,
  };

  const mismatches: string[] = [];
  // Hard checks — year/make/model are reliably present in vPIC data,
  // so a mismatch here is meaningful.
  if (decoded.year && decoded.year !== String(claim.year)) {
    mismatches.push(`Listing says ${claim.year}, VIN decodes to ${decoded.year}.`);
  }
  if (decoded.make && normalize(decoded.make) !== normalize(claim.make)) {
    mismatches.push(`Listing says ${claim.make}, VIN decodes to ${decoded.make}.`);
  }
  if (decoded.model && normalize(decoded.model) !== normalize(claim.model) && !normalize(decoded.model).includes(normalize(claim.model)) && !normalize(claim.model).includes(normalize(decoded.model))) {
    mismatches.push(`Listing says ${claim.model}, VIN decodes to ${decoded.model}.`);
  }
  // Soft checks — only flagged when NHTSA actually returned a value.
  if (decoded.seats && claim.seats && Number(decoded.seats) !== claim.seats) {
    mismatches.push(`Listing says ${claim.seats} seats, VIN decodes to ${decoded.seats}.`);
  }
  if (decoded.transmission && claim.transmission) {
    const decodedIsAuto = /auto/i.test(decoded.transmission);
    const claimIsAuto = claim.transmission === "automatic";
    if (decodedIsAuto !== claimIsAuto) mismatches.push(`Listing says ${claim.transmission}, VIN decodes to ${decoded.transmission}.`);
  }

  return { ok: true, verified: mismatches.length === 0, mismatches, decoded };
}
