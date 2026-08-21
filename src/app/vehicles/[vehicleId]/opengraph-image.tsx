import { ImageResponse } from "next/og";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import { vehiclePhotoUrl } from "@/lib/storage-url";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Hosts can now upload real photos (see migration 0019) — use the
// first one as the card's backdrop when one exists. Older/unphotographed
// listings still get the branded text-only card as a fallback, same as
// before.
export default async function Image({ params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: vehicle } = await supabase.from("vehicles").select("make, model, year, location_city, daily_price, base_currency, photo_paths").eq("id", vehicleId).maybeSingle();

  const title = vehicle ? `${vehicle.make} ${vehicle.model}` : "yoRento";
  const subtitle = vehicle ? `${vehicle.year} · ${vehicle.location_city}, Dominican Republic` : "Your next journey starts here.";
  const price = vehicle ? `${formatMoney(vehicle.daily_price, vehicle.base_currency)} / day` : null;
  const photoUrl = vehicle?.photo_paths?.[0] ? vehiclePhotoUrl(vehicle.photo_paths[0]) : null;

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "#102c25",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        {photoUrl && (
          <img src={photoUrl} alt="" width={size.width} height={size.height} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        {photoUrl && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(16,44,37,.92), rgba(16,44,37,.35))" }} />}
        <div style={{ position: "relative", display: "flex", alignItems: "center", fontSize: 34, fontWeight: 700 }}>
          <span>yo</span>
          <span style={{ color: "#f18a65" }}>Rento</span>
        </div>
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>{title}</div>
          <div style={{ fontSize: 30, color: "rgba(255,255,255,.75)" }}>{subtitle}</div>
          {price && <div style={{ fontSize: 36, color: "#f18a65", fontWeight: 700, marginTop: 8 }}>{price}</div>}
        </div>
      </div>
    ),
    { ...size },
  );
}
