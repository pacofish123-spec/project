import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";

export async function PATCH(request: Request, { params }: { params: Promise<{ extraId: string }> }) {
  try {
    const { extraId } = await params;
    const body = await request.json() as { active?: boolean; price?: number; inventoryCount?: number | null };
    const { supabase } = await requireUser();

    const updates: Record<string, unknown> = {};
    if (typeof body.active === "boolean") updates.active = body.active;
    if (typeof body.price === "number") updates.price = body.price;
    if (body.inventoryCount !== undefined) updates.inventory_count = body.inventoryCount;
    if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

    const { data, error } = await supabase.from("extras").update(updates).eq("id", extraId).select().maybeSingle();
    if (error || !data) return NextResponse.json({ error: "Unable to update this extra." }, { status: error ? 500 : 404 });
    return NextResponse.json({ extra: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to update this extra." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ extraId: string }> }) {
  try {
    const { extraId } = await params;
    const { supabase } = await requireUser();
    const { error } = await supabase.from("extras").delete().eq("id", extraId);
    if (error) return NextResponse.json({ error: "Unable to remove this extra." }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to remove this extra." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}
