"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { formatDate } from "@/lib/format";

interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  country_code: string;
  account_type: string;
  member_since: string;
  capabilities: string[];
}

interface AdminBusiness {
  id: string;
  name: string;
  slug: string;
  country_code: string;
  city: string | null;
  verification_status: string;
  member_count: number;
  created_at: string;
}

export default function AdminDirectoryPage() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [businesses, setBusinesses] = useState<AdminBusiness[] | null>(null);
  const [message, setMessage] = useState("Loading directory...");

  useEffect(() => {
    fetch("/api/admin/users").then(async (response) => {
      const result = await response.json() as { users?: AdminUser[]; businesses?: AdminBusiness[]; error?: string };
      if (!response.ok) { setMessage(result.error ?? "Unable to load the directory."); return; }
      setUsers(result.users ?? []);
      setBusinesses(result.businesses ?? []);
      setMessage("");
    }).catch(() => setMessage("Unable to load the directory."));
  }, []);

  return (
    <>
      <section className="workflow-card wide requests-card">
        <p className="workflow-kicker">Users ({users?.length ?? 0})</p>
        {message && <div className="dashboard-message"><Users size={22} /><p>{message}</p></div>}
        {users && users.length > 0 && (
          <div className="trip-list">
            {users.map((user) => (
              <article className="trip-card" key={user.id}>
                <div>
                  <strong>{user.display_name || "—"}</strong>
                  <span className="trip-status">{user.account_type}</span>
                </div>
                <p className="admin-row-meta">{user.email} · {user.country_code} · member since {formatDate(user.member_since)}</p>
                <div className="admin-reasons">
                  {user.capabilities.length === 0 && <span>no capabilities</span>}
                  {user.capabilities.map((capability) => <span key={capability}>{capability.replace(/^can_/, "").replace(/_/g, " ")}</span>)}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="workflow-card wide requests-card">
        <p className="workflow-kicker">Businesses ({businesses?.length ?? 0})</p>
        {businesses && businesses.length === 0 && <p className="admin-row-meta">No businesses have been created yet.</p>}
        {businesses && businesses.length > 0 && (
          <div className="trip-list">
            {businesses.map((business) => (
              <article className="trip-card" key={business.id}>
                <div>
                  <strong>{business.name}</strong>
                  <span className="trip-status">{business.verification_status.replace("_", " ")}</span>
                </div>
                <p className="admin-row-meta">/{business.slug} · {business.city ? `${business.city}, ` : ""}{business.country_code} · {business.member_count} member{business.member_count === 1 ? "" : "s"} · created {formatDate(business.created_at)}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
