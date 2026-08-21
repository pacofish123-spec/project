import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";
import { getEnabledProviders } from "@/lib/payments";

// Which "Pay with ..." buttons a renter should ever see — only
// providers with real credentials configured, so nobody can click a
// button wired to nothing.
export async function GET() {
  try {
    await requireUser();
    const providers = getEnabledProviders().map((provider) => ({ id: provider.id, label: provider.label }));
    return NextResponse.json({ providers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to load payment options." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}
