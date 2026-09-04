"use client";

import { useEffect, useMemo, useState } from "react";
import { Ban, ChevronDown, ChevronUp, RotateCcw, ShieldCheck, Trash2, Users, X } from "lucide-react";
import { SkeletonCards } from "@/components/skeleton";
import { formatDate } from "@/lib/format";
import { AdminIdChip, AdminSearchBar } from "@/components/admin-search-bar";
import { VerifiedAvatar } from "@/components/verified-avatar";
import type { Capability } from "@/lib/domain";

interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  phone: string | null;
  date_of_birth: string | null;
  country_code: string;
  account_type: string;
  member_since: string;
  status: "active" | "suspended" | "deleted";
  capabilities: string[];
}

interface IdentityDetail {
  status: string;
  provider?: string | null;
  createdAt?: string;
  documentUrls?: string[];
  stripeExtract?: {
    firstName: string | null;
    lastName: string | null;
    dob: string | null;
    documentType: string | null;
    documentNumber: string | null;
    issuingCountry: string | null;
    expirationDate: string | null;
  } | null;
  error?: string;
}

// The admin mini-profile — phone/DOB/avatar are already on the row from
// admin_list_users (migration 0040); identity detail (document photos
// for a manual review, or the extracted fields Stripe's API exposes for
// an automated one) is fetched lazily, once, the first time a row expands.
function UserMiniProfile({ user }: { user: AdminUser }) {
  const [identity, setIdentity] = useState<IdentityDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/users/${user.id}/identity`).then(async (response) => {
      setIdentity(await response.json().catch(() => null) as IdentityDetail | null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user.id]);

  return (
    <div className="admin-mini-profile">
      <div className="admin-mini-profile-head">
        <VerifiedAvatar avatarUrl={user.avatar_url} verified={identity?.status === "verified"} size="large" />
        <div>
          <strong>{user.display_name || "—"}</strong>
          <p className="admin-row-meta">{user.phone || "no phone on file"} · {user.date_of_birth ? `DOB ${formatDate(user.date_of_birth)}` : "no DOB on file"}</p>
        </div>
      </div>
      {loading && <p className="admin-row-meta">Loading ID verification…</p>}
      {!loading && identity && (
        <>
          {identity.status === "not_started" && <p className="admin-row-meta">No ID verification requested yet.</p>}
          {identity.error && <p className="admin-row-meta">{identity.error}</p>}
          {identity.stripeExtract && (
            <div className="admin-reasons">
              <span>{identity.stripeExtract.firstName} {identity.stripeExtract.lastName}</span>
              {identity.stripeExtract.dob && <span>DOB {identity.stripeExtract.dob}</span>}
              {identity.stripeExtract.documentType && <span>{identity.stripeExtract.documentType.replace(/_/g, " ")}</span>}
              {identity.stripeExtract.documentNumber && <span>Doc# {identity.stripeExtract.documentNumber}</span>}
              {identity.stripeExtract.issuingCountry && <span>{identity.stripeExtract.issuingCountry}</span>}
              {identity.stripeExtract.expirationDate && <span>Expires {identity.stripeExtract.expirationDate}</span>}
            </div>
          )}
          {identity.documentUrls && identity.documentUrls.length > 0 && (
            <div className="condition-photo-grid">
              {identity.documentUrls.map((url) => <a href={url} target="_blank" rel="noreferrer" key={url}><img src={url} alt="ID document" /></a>)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const allCapabilities: Capability[] = [
  "can_rent",
  "can_host_personally",
  "can_host_for_business",
  "can_manage_business",
  "can_manage_fleet",
  "can_receive_payouts",
  "can_manage_platform",
];

const statusClass: Record<AdminUser["status"], string> = {
  active: "trip-status-published",
  suspended: "trip-status-paused",
  deleted: "trip-status-cancelled",
};

function label(capability: string) {
  return capability.replace(/^can_/, "").replace(/_/g, " ");
}

export default function AdminDirectoryPage() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [message, setMessage] = useState("Loading directory...");
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [pendingGrant, setPendingGrant] = useState<Record<string, Capability | "">>({});
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState("");

  function load() {
    fetch("/api/admin/users").then(async (response) => {
      const result = await response.json() as { users?: AdminUser[]; error?: string };
      if (!response.ok) { setMessage(result.error ?? "Unable to load the directory."); setLoading(false); return; }
      setUsers(result.users ?? []);
      setMessage("");
      setLoading(false);
    }).catch(() => { setMessage("Unable to load the directory."); setLoading(false); });
  }

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => {
    if (!users) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((user) =>
      user.display_name.toLowerCase().includes(needle)
      || user.email.toLowerCase().includes(needle)
      || user.id.toLowerCase().includes(needle)
      || (user.phone ?? "").toLowerCase().includes(needle)
      || (user.date_of_birth ?? "").includes(needle));
  }, [users, query]);

  async function grant(userId: string) {
    const capability = pendingGrant[userId];
    if (!capability) return;
    setError("");
    setBusyKey(`${userId}:${capability}`);
    const response = await fetch(`/api/admin/users/${userId}/capabilities`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ capability }) });
    if (response.ok) { setPendingGrant((prev) => ({ ...prev, [userId]: "" })); load(); }
    else { const result = await response.json() as { error?: string }; setError(result.error ?? "Unable to grant capability."); }
    setBusyKey("");
  }

  async function revoke(userId: string, capability: string) {
    if (capability === "can_manage_platform" && !window.confirm("Remove admin access for this user?")) return;
    setError("");
    setBusyKey(`${userId}:${capability}`);
    const response = await fetch(`/api/admin/users/${userId}/capabilities`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ capability }) });
    if (response.ok) load();
    else { const result = await response.json() as { error?: string }; setError(result.error ?? "Unable to revoke capability."); }
    setBusyKey("");
  }

  async function setStatus(userId: string, status: AdminUser["status"], confirmMessage?: string, askReason?: boolean) {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    const reason = askReason ? window.prompt("Reason (optional, shown only to admins):") ?? undefined : undefined;
    setError("");
    setBusyKey(`${userId}:status`);
    const response = await fetch(`/api/admin/users/${userId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, reason }) });
    if (response.ok) load();
    else { const result = await response.json() as { error?: string }; setError(result.error ?? "Unable to update this user."); }
    setBusyKey("");
  }

  return (
    <section className="workflow-card wide requests-card">
      <p className="workflow-kicker">Users ({visible.length}{query ? ` of ${users?.length ?? 0}` : ""})</p>
      <AdminSearchBar value={query} onChange={setQuery} placeholder="Search by name, email, id, phone, or DOB…" resultCount={visible.length} totalCount={users?.length ?? 0} />
      {loading && <SkeletonCards />}
      {!loading && message && <div className="dashboard-message"><Users size={22} /><p>{message}</p></div>}
      {error && <p className="workflow-error">{error}</p>}
      {users !== null && visible.length === 0 && !message && <p className="admin-row-meta">No users match this search.</p>}
      {visible.length > 0 && (
        <div className="trip-list">
          {visible.map((user) => {
            const grantableCapabilities = allCapabilities.filter((capability) => !user.capabilities.includes(capability));
            const busy = busyKey === `${user.id}:status`;
            return (
              <article className="trip-card" key={user.id}>
                <div>
                  <strong>{user.display_name || "—"}</strong>
                  <span className={`trip-status ${statusClass[user.status]}`}>{user.status}</span>
                </div>
                <p className="admin-row-meta">{user.email} · {user.country_code} · {user.account_type} · member since {formatDate(user.member_since)} · <AdminIdChip id={user.id} /></p>
                <button className="workflow-link" type="button" onClick={() => setExpandedId(expandedId === user.id ? "" : user.id)}>
                  {expandedId === user.id ? <ChevronUp size={13} style={{ verticalAlign: "-2px" }} /> : <ChevronDown size={13} style={{ verticalAlign: "-2px" }} />} {expandedId === user.id ? "Hide mini profile" : "View mini profile"}
                </button>
                {expandedId === user.id && <UserMiniProfile user={user} />}
                <div className="admin-reasons">
                  {user.capabilities.length === 0 && <span>no capabilities</span>}
                  {user.capabilities.map((capability) => (
                    <span key={capability} className="capability-pill">
                      {capability === "can_manage_platform" && <ShieldCheck size={11} />} {label(capability)}
                      <button type="button" aria-label={`Revoke ${label(capability)}`} disabled={busyKey === `${user.id}:${capability}`} onClick={() => revoke(user.id, capability)}><X size={11} /></button>
                    </span>
                  ))}
                </div>
                {grantableCapabilities.length > 0 && (
                  <div className="capability-grant-row">
                    <select value={pendingGrant[user.id] ?? ""} onChange={(event) => setPendingGrant((prev) => ({ ...prev, [user.id]: event.target.value as Capability }))}>
                      <option value="">Grant a capability…</option>
                      {grantableCapabilities.map((capability) => <option key={capability} value={capability}>{label(capability)}</option>)}
                    </select>
                    <button className="workflow-link" type="button" disabled={!pendingGrant[user.id] || busyKey === `${user.id}:${pendingGrant[user.id]}`} onClick={() => grant(user.id)}>Grant</button>
                  </div>
                )}
                <div className="trip-actions user-status-actions">
                  {user.status !== "active" && (
                    <button className="workflow-link" type="button" disabled={busy} onClick={() => setStatus(user.id, "active")}><RotateCcw size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />Reactivate</button>
                  )}
                  {user.status === "active" && (
                    <button className="workflow-link" type="button" disabled={busy} onClick={() => setStatus(user.id, "suspended", "Suspend this user? They'll be blocked from booking, hosting, or publishing new listings, and their published vehicles will be paused.", true)}><Ban size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />Suspend</button>
                  )}
                  {user.status !== "deleted" && (
                    <button className="workflow-link" type="button" disabled={busy} onClick={() => setStatus(user.id, "deleted", "Remove this user? Their name, phone, and photo are wiped and shown as \"Deleted user\" — this can't be undone. Their bookings/vehicle history stays for records.")}><Trash2 size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />Remove</button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
