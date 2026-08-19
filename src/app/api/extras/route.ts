import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";

interface ExtraInput {
  name?: string;
  description?: string;
  price?: number;
  currency?: string;
  inventoryCount?: number | null;
  businessId?: string | null;
}

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase.from("extras").select("*").eq("owner_user_id", user.id).order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: "Unable to load extras." }, { status: 500 });
    return NextResponse.json({ extras: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to load extras." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as ExtraInput;
    if (!body.name || body.price === undefined || body.price === null) {
      return NextResponse.json({ error: "Name and price are required." }, { status: 400 });
    }
    const { supabase, user } = await requireUser();

    const { data, error } = await supabase.from("extras").insert({
      owner_user_id: user.id,
      business_id: body.businessId ?? null,
      name: body.name,
      description: body.description ?? null,
      price: body.price,
      currency: body.currency ?? "DOP",
      inventory_count: body.inventoryCount ?? null,
      active: true,
    }).select().single();

    if (error) return NextResponse.json({ error: "Unable to create this extra." }, { status: 500 });
    return NextResponse.json({ extra: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to create this extra." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}
