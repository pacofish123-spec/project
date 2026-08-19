import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizePhone, getSafeDuplicateMessage } from "@/lib/identity";
import type { DuplicateMatchLevel } from "@/lib/domain";

// Best-effort in-memory rate limit. This resets on cold start and isn't
// shared across serverless instances — it raises the cost of naive
// scripted probing without needing a shared store. For real production
// traffic this should move to a durable limiter (e.g. Upstash Redis).
const attempts = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS_PER_WINDOW = 8;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  attempts.set(key, recent);
  return recent.length > MAX_ATTEMPTS_PER_WINDOW;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string; phone?: string; name?: string; dateOfBirth?: string };
    if (!body.email) return NextResponse.json({ error: "Email is required." }, { status: 400 });

    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (isRateLimited(clientIp)) {
      return NextResponse.json({ error: "Too many attempts. Please try again in a minute." }, { status: 429 });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("check_registration_identity", {
      registration_email: body.email,
      registration_phone: body.phone ? normalizePhone(body.phone) : null,
      registration_name: body.name ?? null,
      registration_date_of_birth: body.dateOfBirth ?? null,
    });
    if (error) return NextResponse.json({ error: "Unable to check registration." }, { status: 500 });

    const level = data as DuplicateMatchLevel;
    // The exact match level never leaves the server — only whether the
    // person can continue, plus a generic message. Revealing the level
    // itself (or a message that varies by exactly which signal matched)
    // is an account-enumeration oracle.
    return NextResponse.json({
      canContinue: level === "NO_MATCH" || level === "POSSIBLE_MATCH",
      requiresReview: level === "POSSIBLE_MATCH",
      message: getSafeDuplicateMessage(level),
    });
  } catch {
    return NextResponse.json({ error: "Unable to check registration." }, { status: 500 });
  }
}
