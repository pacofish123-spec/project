"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Wallet } from "lucide-react";
import { EarningsChart } from "@/components/earnings-chart";
import { SkeletonRows } from "@/components/skeleton";

interface Totals { gross: number; platformFee: number; bookings: number }
interface EarningsResponse {
  currencies: string[];
  currency: string;
  granularity: string;
  range: { start: string; end: string };
  series: Array<{ bucket: string; gross: number; platformFee: number; bookings: number }>;
  totals: Totals;
  previousTotals: Totals;
}

type Granularity = "day" | "week" | "month" | "year";
type RangePreset = "7" | "30" | "90" | "year" | "custom";

const granularities: Array<{ value: Granularity; label: string }> = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
  { value: "year", label: "Yearly" },
];
const rangePresets: Array<{ value: RangePreset; label: string }> = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "year", label: "This year" },
  { value: "custom", label: "Custom range" },
];

function isoDate(date: Date) { return date.toISOString().slice(0, 10); }

function computeRange(preset: RangePreset, customStart: string, customEnd: string): { start: string; end: string } {
  const today = new Date();
  if (preset === "custom") return { start: customStart || isoDate(today), end: customEnd || isoDate(today) };
  if (preset === "year") return { start: `${today.getUTCFullYear()}-01-01`, end: isoDate(today) };
  const days = preset === "7" ? 6 : preset === "30" ? 29 : 89;
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - days);
  return { start: isoDate(start), end: isoDate(today) };
}

function formatCompact(value: number, currency: string): string {
  if (Math.abs(value) >= 1000) return `${currency} ${(value / 1000).toFixed(1)}K`;
  return `${currency} ${value.toFixed(0)}`;
}

function bucketLabel(bucket: string, granularity: string): string {
  if (granularity === "year") return bucket;
  if (granularity === "month") return new Date(`${bucket}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  return new Date(`${bucket}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return current === 0 ? null : <span className="delta-badge delta-up"><ArrowUp size={11} /> new</span>;
  const change = ((current - previous) / previous) * 100;
  const up = change >= 0;
  return (
    <span className={`delta-badge ${up ? "delta-up" : "delta-down"}`}>
      {up ? <ArrowUp size={11} /> : <ArrowDown size={11} />} {Math.abs(change).toFixed(0)}% vs previous period
    </span>
  );
}

export default function AdminEarningsPage() {
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [rangePreset, setRangePreset] = useState<RangePreset>("30");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [currency, setCurrency] = useState("");
  const [data, setData] = useState<EarningsResponse | null>(null);
  const [message, setMessage] = useState("Loading earnings...");
  const [loading, setLoading] = useState(true);
  const [showTable, setShowTable] = useState(false);

  const range = useMemo(() => computeRange(rangePreset, customStart, customEnd), [rangePreset, customStart, customEnd]);

  useEffect(() => {
    const params = new URLSearchParams({ granularity, start: range.start, end: `${range.end}T23:59:59.999Z` });
    if (currency) params.set("currency", currency);
    fetch(`/api/admin/earnings?${params}`).then(async (response) => {
      const result = await response.json() as EarningsResponse & { error?: string };
      if (!response.ok) { setMessage((result as { error?: string }).error ?? "Unable to load earnings."); setLoading(false); return; }
      setData(result);
      if (!currency) setCurrency(result.currency);
      setMessage("");
      setLoading(false);
    }).catch(() => { setMessage("Unable to load earnings."); setLoading(false); });
  }, [granularity, range.start, range.end, currency]);

  const points = (data?.series ?? []).map((row) => ({ label: bucketLabel(row.bucket, granularity), value: row.platformFee }));

  return (
    <>
      <div className="admin-filters-row">
        <div className="admin-filters">
          {rangePresets.map((preset) => (
            <button key={preset.value} className={rangePreset === preset.value ? "active" : ""} type="button" onClick={() => setRangePreset(preset.value)}>{preset.label}</button>
          ))}
        </div>
        <div className="admin-filters">
          {granularities.map((option) => (
            <button key={option.value} className={granularity === option.value ? "active" : ""} type="button" onClick={() => setGranularity(option.value)}>{option.label}</button>
          ))}
        </div>
        {data && data.currencies.length > 1 && (
          <select className="currency-select" value={currency} onChange={(event) => setCurrency(event.target.value)}>
            {data.currencies.map((code) => <option key={code} value={code}>{code}</option>)}
          </select>
        )}
      </div>

      {rangePreset === "custom" && (
        <div className="custom-range-row">
          <label>From <input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></label>
          <label>To <input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></label>
        </div>
      )}

      {loading && <SkeletonRows count={5} />}
      {!loading && message && <div className="dashboard-message"><Wallet size={22} /><p>{message}</p></div>}

      {data && (
        <>
          <div className="dashboard-grid">
            <div className="dashboard-tile">
              <Wallet size={20} />
              <strong>{formatCompact(data.totals.platformFee, data.currency)}</strong>
              <span>Platform fee earned</span>
              <DeltaBadge current={data.totals.platformFee} previous={data.previousTotals.platformFee} />
            </div>
            <div className="dashboard-tile">
              <Wallet size={20} />
              <strong>{formatCompact(data.totals.gross, data.currency)}</strong>
              <span>Gross booking revenue</span>
              <DeltaBadge current={data.totals.gross} previous={data.previousTotals.gross} />
            </div>
            <div className="dashboard-tile">
              <Wallet size={20} />
              <strong>{data.totals.bookings}</strong>
              <span>Revenue-eligible bookings</span>
              <DeltaBadge current={data.totals.bookings} previous={data.previousTotals.bookings} />
            </div>
            <div className="dashboard-tile">
              <Wallet size={20} />
              <strong>{formatCompact(data.totals.bookings ? data.totals.platformFee / data.totals.bookings : 0, data.currency)}</strong>
              <span>Avg fee per booking</span>
            </div>
          </div>

          <section className="workflow-card wide requests-card">
            <p className="workflow-kicker">Platform fee trend ({data.currency}) — {granularities.find((g) => g.value === granularity)?.label.toLowerCase()}</p>
            <EarningsChart points={points} formatValue={(value) => formatCompact(value, data.currency)} />
          </section>

          <section className="workflow-card wide requests-card">
            <button className="workflow-link" type="button" onClick={() => setShowTable((value) => !value)}>{showTable ? "Hide" : "View"} as table</button>
            {showTable && (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Period</th><th>Bookings</th><th>Gross</th><th>Platform fee</th></tr></thead>
                  <tbody>
                    {data.series.map((row) => (
                      <tr key={row.bucket}>
                        <td>{bucketLabel(row.bucket, granularity)}</td>
                        <td>{row.bookings}</td>
                        <td>{formatCompact(row.gross, data.currency)}</td>
                        <td>{formatCompact(row.platformFee, data.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
