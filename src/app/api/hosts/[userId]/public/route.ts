import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Public, unauthenticated — everything selected here is already meant
// to be visible to a browsing renter deciding whether to book (the
// same information a vehicle-card star rating already implies).
export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const supabase = await createSupabaseServerClient();

  const [{ data: profile }, { data: stats }, { data: reviews }] = await Promise.all([
    supabase.from("public_profiles").select("id, display_name, avatar_url, member_since").eq("id", userId).maybeSingle(),
    supabase.from("public_host_profiles").select("rating, completed_rentals, response_rate").eq("user_id", userId).maybeSingle(),
    supabase.from("reviews").select("rating, body, created_at, author_user_id").eq("subject_user_id", userId).order("created_at", { ascending: false }).limit(6),
  ]);

  if (!profile) return NextResponse.json({ error: "Host not found." }, { status: 404 });

  const authorIds = [...new Set((reviews ?? []).map((review) => review.author_user_id).filter(Boolean))];
  const { data: authors } = authorIds.length
    ? await supabase.from("public_profiles").select("id, display_name").in("id", authorIds)
    : { data: [] };
  const authorNames = new Map((authors ?? []).map((author) => [author.id, author.display_name]));

  return NextResponse.json({
    profile,
    stats: stats ?? { rating: null, completed_rentals: 0, response_rate: null },
    reviews: (reviews ?? []).map((review) => ({ ...review, author_display_name: authorNames.get(review.author_user_id) ?? "—" })),
  });
}
