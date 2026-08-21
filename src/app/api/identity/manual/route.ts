import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";

// Manual fallback for when automated verification isn't configured or
// didn't work out — the renter has already uploaded their ID photo(s)
// straight to the identity-documents bucket from the browser (RLS
// restricts that to their own folder); this just files the request
// into the same admin verification queue vehicles already use.
export async function POST(request: Request) {
  try {
    const body = await request.json() as { documentPaths?: string[] };
    if (!body.documentPaths || body.documentPaths.length === 0) {
      return NextResponse.json({ error: "Upload at least one photo of your ID first." }, { status: 400 });
    }

    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("request_identity_verification", { target_document_paths: body.documentPaths });

    if (error) {
      const reason = error.message ?? "";
      if (reason.includes("VERIFICATION_ALREADY_REQUESTED")) return NextResponse.json({ error: "You already have an ID verification in progress." }, { status: 409 });
      return NextResponse.json({ error: "Unable to submit your ID for review." }, { status: 500 });
    }

    return NextResponse.json({ verification: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    if (message === "AUTHENTICATION_REQUIRED") return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    return NextResponse.json({ error: "Unable to submit your ID for review." }, { status: 500 });
  }
}
