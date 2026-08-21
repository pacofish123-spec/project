import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function keyForDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Public, unauthenticated — a browsing guest needs to see which days
// are already spoken for before they're ever asked to sign in, the
// same information /api/vehicles' own search filtering already relies
// on internally.
export async function GET(_request: Request, { params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .rpc("public_booking_availability")
    .select("starts_at, ends_at")
    .eq("vehicle_id", vehicleId);

  if (error) return NextResponse.json({ error: "Unable to load availability." }, { status: 500 });

  // Day-level, inclusive of both ends — a renter picking up or
  // dropping off on a day another booking already touches still needs
  // to see that day flagged, even though the exact hours might not
  // truly overlap. Coarser than the real timestamp overlap check
  // create_booking enforces, but that's the right trade for a calendar
  // a human is scanning by eye.
  const bookedDates = new Set<string>();
  for (const booking of (data ?? []) as Array<{ starts_at: string; ends_at: string }>) {
    const cursor = new Date(booking.starts_at);
    const end = new Date(booking.ends_at);
    cursor.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    while (cursor <= end) {
      bookedDates.add(keyForDate(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return NextResponse.json({ bookedDates: [...bookedDates] });
}
