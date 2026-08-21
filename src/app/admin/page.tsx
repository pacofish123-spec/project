"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BarChart3, Building2, CalendarClock, CarFront, CheckCircle2, Copy, LayoutDashboard, ShieldCheck, Users, Wallet } from "lucide-react";
import { formatDate, formatMoney } from "@/lib/format";

interface Overview {
  counts: {
    users: number;
    vehicles: number;
    publishedVehicles: number;
    businesses: number;
    bookings: number;
    openDisputes: number;
  };
  pendingTasks: {
    vehiclesAwaitingPublish: number;
    verificationAwaitingReview: number;
    duplicatesAwaitingReview: number;
    openDisputes: number;
  };
  earningsByCurrency: Array<{ currency: string; gross: number; platformFee: number }>;
  recentActivity: Array<{ id: string; event_type: string; target_type: string | null; created_at: string; metadata: Record<string, unknown> }>;
}

export default function AdminOverviewPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [message, setMessage] = useState("Loading overview...");

  useEffect(() => {
    fetch("/api/admin/overview").then(async (response) => {
      const result = await response.json() as Overview & { error?: string };
      if (!response.ok) { setMessage((result as { error?: string }).error ?? "Unable to load overview."); return; }
      setOverview(result);
      setMessage("");
    }).catch(() => setMessage("Unable to load overview."));
  }, []);

  if (message) return <div className="dashboard-message"><LayoutDashboard size={22} /><p>{message}</p></div>;
  if (!overview) return null;

  const { counts, pendingTasks, earningsByCurrency, recentActivity } = overview;
  const tasks = [
    { count: pendingTasks.vehiclesAwaitingPublish, label: "Vehicles awaiting publish", href: "/admin/vehicles", icon: CarFront },
    { count: pendingTasks.verificationAwaitingReview, label: "Verification requests to review", href: "/admin/verification", icon: ShieldCheck },
    { count: pendingTasks.duplicatesAwaitingReview, label: "Duplicate accounts to review", href: "/admin/duplicates", icon: Copy },
    { count: pendingTasks.openDisputes, label: "Open disputes", href: "/admin/disputes", icon: AlertTriangle },
  ];
  const openTasks = tasks.filter((task) => task.count > 0);

  const earningsSummary = earningsByCurrency.length > 0
    ? earningsByCurrency.map((entry) => formatMoney(entry.platformFee, entry.currency)).join(" · ")
    : "No earnings yet";

  // One card per tab in the admin nav (Overview excluded — it's this
  // page), so every stat is a real shortcut into the tab it summarizes
  // instead of a dead-end number.
  const tabCards = [
    { icon: Users, value: String(counts.users), label: "Users", href: "/admin/users" },
    { icon: CarFront, value: `${counts.publishedVehicles} / ${counts.vehicles}`, label: "Published vehicles", href: "/admin/vehicles" },
    { icon: Building2, value: String(counts.businesses), label: "Businesses", href: "/admin/businesses" },
    { icon: CalendarClock, value: String(counts.bookings), label: "Bookings", href: "/admin/bookings" },
    { icon: AlertTriangle, value: String(counts.openDisputes), label: "Open disputes", href: "/admin/disputes" },
    { icon: ShieldCheck, value: String(pendingTasks.verificationAwaitingReview), label: "Verification requests to review", href: "/admin/verification" },
    { icon: Copy, value: String(pendingTasks.duplicatesAwaitingReview), label: "Duplicate accounts to review", href: "/admin/duplicates" },
    { icon: Wallet, value: earningsSummary, label: "Platform earnings", href: "/admin/earnings" },
    { icon: BarChart3, value: "", label: "Site analytics", href: "/admin/analytics" },
  ];

  return (
    <>
      <section className="workflow-card wide requests-card">
        <p className="workflow-kicker">Pending tasks</p>
        {openTasks.length === 0 && <p className="admin-row-meta"><CheckCircle2 size={14} style={{ verticalAlign: "-2px", marginRight: 5 }} />Nothing needs your attention right now.</p>}
        {openTasks.length > 0 && (
          <div className="trip-list">
            {openTasks.map((task) => (
              <Link className="trip-card pending-task-card" href={task.href} key={task.label}>
                <div>
                  <strong><task.icon size={16} style={{ verticalAlign: "-3px", marginRight: 7 }} />{task.label}</strong>
                  <span className="trip-status trip-status-pending_review">{task.count}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="dashboard-grid">
        {tabCards.map((card) => (
          <Link className="dashboard-tile" href={card.href} key={card.href}>
            <card.icon size={20} />
            {card.value && <strong>{card.value}</strong>}
            <span>{card.label}</span>
          </Link>
        ))}
      </div>

      <section className="workflow-card wide requests-card">
        <p className="workflow-kicker">Recent admin activity</p>
        {recentActivity.length === 0 && <p className="admin-row-meta">No admin actions logged yet.</p>}
        {recentActivity.length > 0 && (
          <div className="trip-list">
            {recentActivity.map((entry) => (
              <article className="trip-card" key={entry.id}>
                <div>
                  <strong>{entry.event_type.replace(/_/g, " ")}</strong>
                  <span className="trip-status">{entry.target_type ?? "—"}</span>
                </div>
                <p className="admin-row-meta">{formatDate(entry.created_at)}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
