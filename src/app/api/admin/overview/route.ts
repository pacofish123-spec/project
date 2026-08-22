import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/authorization";

export async function GET() {
  try {
    const { supabase } = await requireCapability("can_manage_platform");

    const [
      { count: userCount },
      { count: vehicleCount },
      { count: publishedVehicleCount },
      { count: businessCount },
      { count: bookingCount },
      { count: disputedCount },
      { count: pendingVehicleCount },
      { count: pendingVerificationCount },
      { count: pendingDuplicateCount },
      { data: revenueRows },
      { data: recentActivity },
    ] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("vehicles").select("id", { count: "exact", head: true }),
      supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("status", "published"),
      supabase.from("businesses").select("id", { count: "exact", head: true }),
      supabase.from("bookings").select("id", { count: "exact", head: true }),
      supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "disputed"),
      supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
      supabase.from("verification_records").select("id", { count: "exact", head: true }).in("status", ["pending", "in_review"]),
      supabase.from("account_merge_candidates").select("id", { count: "exact", head: true }).in("status", ["flagged", "under_review"]),
      supabase.from("bookings").select("total, platform_fee, currency, status").not("status", "in", "(requested,declined,cancelled)"),
      supabase.from("audit_logs").select("id, event_type, target_type, metadata, created_at").order("created_at", { ascending: false }).limit(12),
    ]);

    const totalsByCurrency = new Map<string, { gross: number; platformFee: number }>();
    for (const row of revenueRows ?? []) {
      const entry = totalsByCurrency.get(row.currency) ?? { gross: 0, platformFee: 0 };
      entry.gross += Number(row.total) || 0;
      entry.platformFee += Number(row.platform_fee) || 0;
      totalsByCurrency.set(row.currency, entry);
    }
    const earningsByCurrency = [...totalsByCurrency.entries()].map(([currency, totals]) => ({ currency, ...totals }));

    return NextResponse.json({
      counts: {
        users: userCount ?? 0,
        vehicles: vehicleCount ?? 0,
        publishedVehicles: publishedVehicleCount ?? 0,
        businesses: businessCount ?? 0,
        bookings: bookingCount ?? 0,
        openDisputes: disputedCount ?? 0,
      },
      pendingTasks: {
        vehiclesAwaitingPublish: pendingVehicleCount ?? 0,
        verificationAwaitingReview: pendingVerificationCount ?? 0,
        duplicatesAwaitingReview: pendingDuplicateCount ?? 0,
        openDisputes: disputedCount ?? 0,
      },
      earningsByCurrency,
      recentActivity: recentActivity ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "CAPABILITY_REQUIRED" ? 403 : 500;
    return NextResponse.json({ error: status === 401 ? "Sign in is required." : status === 403 ? "Admin access required." : "Unable to load overview." }, { status });
  }
}
