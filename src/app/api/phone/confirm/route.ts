import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { requireUser } from "@/lib/authorization";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { code?: string };
    if (!body.code?.trim()) return NextResponse.json({ error: "Enter the code you received." }, { status: 400 });

    const { supabase } = await requireUser();
    const codeHash = createHash("sha256").update(body.code.trim()).digest("hex");
    const { data, error } = await supabase.rpc("confirm_phone_verification_code", { submitted_code_hash: codeHash });

    if (error) {
      const reason = error.message ?? "";
      if (reason.includes("CODE_EXPIRED")) return NextResponse.json({ error: "That code expired — request a new one." }, { status: 409 });
      if (reason.includes("TOO_MANY_ATTEMPTS")) return NextResponse.json({ error: "Too many attempts — request a new code." }, { status: 429 });
      return NextResponse.json({ error: "Unable to confirm this code." }, { status: 500 });
    }

    if (!data) return NextResponse.json({ error: "That code doesn't match." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    if (message === "AUTHENTICATION_REQUIRED") return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    return NextResponse.json({ error: "Unable to confirm this code." }, { status: 500 });
  }
}
