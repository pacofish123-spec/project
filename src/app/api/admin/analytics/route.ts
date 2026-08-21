import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/authorization";

export async function GET(request: Request) {
  try {
    const { supabase } = await requireCapability("can_manage_platform");
    const url = new URL(request.url);
    const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 30, 1), 90);
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - (days - 1));
    since.setUTCHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("page_views")
      .select("path, session_id, device_type, platform, created_at")
      .eq("platform", "web")
      .gte("created_at", since.toISOString());
    if (error) {
      console.error("admin/analytics page_views query error:", error);
      return NextResponse.json({ error: "Unable to load analytics." }, { status: 500 });
    }

    const rows = data ?? [];
    const uniqueSessions = new Set(rows.map((row) => row.session_id));
    const byDay = new Map<string, { views: number; sessions: Set<string> }>();
    const byPath = new Map<string, number>();
    const byDevice = new Map<string, number>();

    for (const row of rows) {
      const day = row.created_at.slice(0, 10);
      const dayEntry = byDay.get(day) ?? { views: 0, sessions: new Set<string>() };
      dayEntry.views += 1;
      dayEntry.sessions.add(row.session_id);
      byDay.set(day, dayEntry);

      byPath.set(row.path, (byPath.get(row.path) ?? 0) + 1);
      byDevice.set(row.device_type, (byDevice.get(row.device_type) ?? 0) + 1);
    }

    const trend = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, entry]) => ({ day, views: entry.views, uniqueSessions: entry.sessions.size }));

    const topPages = [...byPath.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([path, views]) => ({ path, views }));

    const deviceBreakdown = [...byDevice.entries()].map(([device, views]) => ({ device, views }));

    return NextResponse.json({
      web: {
        totalViews: rows.length,
        uniqueSessions: uniqueSessions.size,
        avgViewsPerSession: uniqueSessions.size ? Math.round((rows.length / uniqueSessions.size) * 10) / 10 : 0,
        trend,
        topPages,
        deviceBreakdown,
      },
      // No native app exists in this codebase yet — these stay at zero
      // until one exists and starts logging its own page_views rows
      // with platform = 'ios' / 'android'.
      ios: { totalViews: 0, uniqueSessions: 0 },
      android: { totalViews: 0, uniqueSessions: 0 },
      days,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "CAPABILITY_REQUIRED" ? 403 : 500;
    if (status === 500) console.error("admin/analytics GET error:", error);
    return NextResponse.json({ error: status === 403 ? "Admin access required." : "Unable to load analytics." }, { status });
  }
}
