import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("currency_rates").select("currency, usd_rate");
    if (error) return NextResponse.json({ error: "Unable to load currency rates." }, { status: 500 });
    return NextResponse.json({ rates: data });
  } catch {
    return NextResponse.json({ error: "Unable to load currency rates." }, { status: 500 });
  }
}
