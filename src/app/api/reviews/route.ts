import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";

interface ReviewInput {
  bookingId?: string;
  rating?: number;
  body?: string;
  consentPublic?: boolean;
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as ReviewInput;
    if (!input.bookingId || !input.rating) {
      return NextResponse.json({ error: "A rating is required." }, { status: 400 });
    }

    const { supabase } = await requireUser();
    const { data: review, error } = await supabase.rpc("submit_review", {
      target_booking_id: input.bookingId,
      p_rating: input.rating,
      p_body: input.body ?? null,
      p_consent_public: Boolean(input.consentPublic),
    });

    if (error) {
      const reason = error.message ?? "";
      if (reason.includes("ALREADY_REVIEWED")) return NextResponse.json({ error: "You've already reviewed this trip.", code: "ALREADY_REVIEWED" }, { status: 409 });
      if (reason.includes("BOOKING_NOT_COMPLETED")) return NextResponse.json({ error: "This trip isn't completed yet." }, { status: 409 });
      if (reason.includes("BOOKING_ACCESS_DENIED")) return NextResponse.json({ error: "You weren't part of this trip." }, { status: 403 });
      if (reason.includes("INVALID_RATING")) return NextResponse.json({ error: "Choose a rating between 1 and 5." }, { status: 400 });
      return NextResponse.json({ error: "Unable to submit your review." }, { status: 500 });
    }

    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Sign in is required." : "Unable to submit your review." }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 500 });
  }
}
