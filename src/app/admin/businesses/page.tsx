"use client";

import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { SkeletonCards } from "@/components/skeleton";
import { formatDate } from "@/lib/format";

interface AdminBusiness {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  country_code: string;
  verification_status: string;
  created_at: string;
  vehicle_count: number;
  published_vehicle_count: number;
  members: Array<{ user_id: string; display_name: string; role: string }>;
}

export default function AdminBusinessesPage() {
  const [businesses, setBusinesses] = useState<AdminBusiness[] | null>(null);
  const [message, setMessage] = useState("Loading businesses...");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/businesses").then(async (response) => {
      const result = await response.json() as { businesses?: AdminBusiness[]; error?: string };
      if (!response.ok) { setMessage(result.error ?? "Unable to load businesses."); setLoading(false); return; }
      setBusinesses(result.businesses ?? []);
      setMessage("");
      setLoading(false);
    }).catch(() => { setMessage("Unable to load businesses."); setLoading(false); });
  }, []);

  return (
    <section className="workflow-card wide requests-card">
      <p className="workflow-kicker">All businesses ({businesses?.length ?? 0})</p>
      {loading && <SkeletonCards />}
      {!loading && message && <div className="dashboard-message"><Building2 size={22} /><p>{message}</p></div>}
      {businesses !== null && businesses.length === 0 && <p className="admin-row-meta">No businesses have been created yet.</p>}
      {businesses && businesses.length > 0 && (
        <div className="trip-list">
          {businesses.map((business) => (
            <article className="trip-card" key={business.id}>
              <div>
                <strong>{business.name}</strong>
                <span className={`trip-status trip-status-${business.verification_status === "verified" ? "published" : business.verification_status === "rejected" ? "cancelled" : "pending_review"}`}>{business.verification_status.replace(/_/g, " ")}</span>
              </div>
              <p className="admin-row-meta">/{business.slug} · {business.city ? `${business.city}, ` : ""}{business.country_code} · {business.published_vehicle_count}/{business.vehicle_count} vehicles published · created {formatDate(business.created_at)}</p>
              <div className="admin-reasons">
                {business.members.length === 0 && <span>no members</span>}
                {business.members.map((member) => <span key={member.user_id}>{member.display_name} ({member.role})</span>)}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
