"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2 } from "lucide-react";
import { SkeletonCards } from "@/components/skeleton";
import { formatDate } from "@/lib/format";
import { AdminIdChip, AdminSearchBar } from "@/components/admin-search-bar";

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
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/admin/businesses").then(async (response) => {
      const result = await response.json() as { businesses?: AdminBusiness[]; error?: string };
      if (!response.ok) { setMessage(result.error ?? "Unable to load businesses."); setLoading(false); return; }
      setBusinesses(result.businesses ?? []);
      setMessage("");
      setLoading(false);
    }).catch(() => { setMessage("Unable to load businesses."); setLoading(false); });
  }, []);

  const visible = useMemo(() => {
    if (!businesses) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return businesses;
    return businesses.filter((business) =>
      business.id.toLowerCase().includes(needle)
      || business.slug.toLowerCase().includes(needle)
      || business.name.toLowerCase().includes(needle)
      || business.members.some((member) => member.user_id.toLowerCase().includes(needle) || member.display_name.toLowerCase().includes(needle)));
  }, [businesses, query]);

  return (
    <section className="workflow-card wide requests-card">
      <p className="workflow-kicker">All businesses ({businesses?.length ?? 0})</p>
      <AdminSearchBar value={query} onChange={setQuery} placeholder="Search by business id, slug, name, or member name/id…" resultCount={visible.length} totalCount={businesses?.length ?? 0} />
      {loading && <SkeletonCards />}
      {!loading && message && <div className="dashboard-message"><Building2 size={22} /><p>{message}</p></div>}
      {businesses !== null && visible.length === 0 && <p className="admin-row-meta">No businesses match this search.</p>}
      {visible.length > 0 && (
        <div className="trip-list">
          {visible.map((business) => (
            <article className="trip-card" key={business.id}>
              <div>
                <strong>{business.name}</strong>
                <span className={`trip-status trip-status-${business.verification_status === "verified" ? "published" : business.verification_status === "rejected" ? "cancelled" : "pending_review"}`}>{business.verification_status.replace(/_/g, " ")}</span>
              </div>
              <p className="admin-row-meta">/{business.slug} · {business.city ? `${business.city}, ` : ""}{business.country_code} · {business.published_vehicle_count}/{business.vehicle_count} vehicles published · created {formatDate(business.created_at)} · <AdminIdChip id={business.id} /></p>
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
