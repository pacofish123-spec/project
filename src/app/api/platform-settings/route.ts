import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Public, unauthenticated — the deposit/waiver choice on the pay step
// and the CDC badge on a listing both need to know these values before
// a renter is signed in at all. Row-level security already restricts
// writes to platform admins (migration 0043); this just exposes the
// one row for anyone to read.
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("platform_settings").select("*").eq("id", true).single();
    if (error || !data) return NextResponse.json({ error: "Settings unavailable." }, { status: 503 });
    return NextResponse.json({ settings: data });
  } catch {
    return NextResponse.json({ error: "Settings unavailable." }, { status: 503 });
  }
}
