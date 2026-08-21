"use client";

import { useEffect, useState } from "react";
import { Apple, Bot, Eye, Globe2, MonitorSmartphone, Users } from "lucide-react";
import { EarningsChart } from "@/components/earnings-chart";
import { SkeletonTiles } from "@/components/skeleton";

interface WebAnalytics {
  totalViews: number;
  uniqueSessions: number;
  avgViewsPerSession: number;
  trend: Array<{ day: string; views: number; uniqueSessions: number }>;
  topPages: Array<{ path: string; views: number }>;
  deviceBreakdown: Array<{ device: string; views: number }>;
}

interface Analytics {
  web: WebAnalytics;
  ios: { totalViews: number; uniqueSessions: number };
  android: { totalViews: number; uniqueSessions: number };
  days: number;
}

const rangeOptions = [
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
];

function dayLabel(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Analytics | null>(null);
  const [message, setMessage] = useState("Loading analytics...");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    queueMicrotask(() => { setMessage("Loading analytics..."); setLoading(true); });
    fetch(`/api/admin/analytics?days=${days}`).then(async (response) => {
      const result = await response.json() as Analytics & { error?: string };
      if (!response.ok) { setMessage((result as { error?: string }).error ?? "Unable to load analytics."); setLoading(false); return; }
      setData(result);
      setMessage("");
      setLoading(false);
    }).catch(() => { setMessage("Unable to load analytics."); setLoading(false); });
  }, [days]);

  return (
    <>
      <div className="admin-filters">
        {rangeOptions.map((option) => (
          <button key={option.value} className={days === option.value ? "active" : ""} type="button" onClick={() => setDays(option.value)}>{option.label}</button>
        ))}
      </div>

      {loading && <SkeletonTiles count={3} />}
      {!loading && message && <div className="dashboard-message"><Globe2 size={22} /><p>{message}</p></div>}

      {data && (
        <>
          <p className="workflow-kicker" style={{ marginTop: 22 }}><Globe2 size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />Website</p>
          <div className="dashboard-grid">
            <div className="dashboard-tile"><Eye size={20} /><strong>{data.web.totalViews}</strong><span>Pageviews</span></div>
            <div className="dashboard-tile"><Users size={20} /><strong>{data.web.uniqueSessions}</strong><span>Unique visitors</span></div>
            <div className="dashboard-tile"><MonitorSmartphone size={20} /><strong>{data.web.avgViewsPerSession}</strong><span>Avg pages / visit</span></div>
          </div>

          <section className="workflow-card wide requests-card">
            <p className="workflow-kicker">Traffic trend</p>
            <EarningsChart points={data.web.trend.map((entry) => ({ label: dayLabel(entry.day), value: entry.views }))} formatValue={(value) => String(Math.round(value))} />
          </section>

          <section className="workflow-card wide requests-card">
            <p className="workflow-kicker">Top pages</p>
            {data.web.topPages.length === 0 && <p className="admin-row-meta">No traffic recorded in this range yet.</p>}
            {data.web.topPages.length > 0 && (
              <div className="trip-list">
                {data.web.topPages.map((page) => (
                  <article className="trip-card" key={page.path}>
                    <div><strong>{page.path}</strong><span className="trip-status">{page.views} view{page.views === 1 ? "" : "s"}</span></div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="workflow-card wide requests-card">
            <p className="workflow-kicker">Devices</p>
            <div className="admin-reasons">
              {data.web.deviceBreakdown.length === 0 && <span>No data yet</span>}
              {data.web.deviceBreakdown.map((entry) => <span key={entry.device}>{entry.device}: {entry.views}</span>)}
            </div>
          </section>

          <p className="workflow-kicker" style={{ marginTop: 34 }}>Native apps</p>
          <div className="dashboard-grid">
            <div className="dashboard-tile app-placeholder-tile"><Apple size={20} /><strong>0</strong><span>iOS — no app yet</span></div>
            <div className="dashboard-tile app-placeholder-tile"><Bot size={20} /><strong>0</strong><span>Android — no app yet</span></div>
          </div>
          <p className="admin-row-meta">These stay at zero until a native app exists and logs its own traffic — the data model is ready (page_views.platform already accepts &quot;ios&quot; / &quot;android&quot;), there&apos;s just nothing to report yet.</p>
        </>
      )}
    </>
  );
}
