import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30);
    if (error) return NextResponse.json({ error: "Unable to load notifications." }, { status: 500 });
    return NextResponse.json({ notifications: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to load notifications." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}
