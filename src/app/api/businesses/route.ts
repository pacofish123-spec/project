import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";

interface BusinessInput {
  name?: string;
  slug?: string;
  description?: string;
  countryCode?: string;
  city?: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as BusinessInput;
    if (!body.name || !body.slug) return NextResponse.json({ error: "Business name and slug are required." }, { status: 400 });
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("create_business", {
      business_name: body.name,
      business_slug: body.slug,
      business_description: body.description ?? null,
      business_country_code: body.countryCode ?? "DO",
      business_city: body.city ?? null,
    });
    if (error) return NextResponse.json({ error: "Unable to create business." }, { status: 400 });
    return NextResponse.json({ business: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : 500;
    return NextResponse.json({ error: "Unable to create business." }, { status });
  }
}