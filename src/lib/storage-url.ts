// vehicle-photos is a public bucket (see migration 0019) — object paths
// stored on vehicles.photo_paths resolve to a plain, deterministic
// public URL with no signing/session needed, so this is safe to call
// from server components, API routes, and client components alike.
export function vehiclePhotoUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/vehicle-photos/${path}`;
}
