"use client";

import { useCallback, useEffect, useState } from "react";

type Range = 7 | 28 | 90;
type Metric = { value: number; previous: number | null; change: number | null };
type Ranked = { name: string; visitors: number; share: number | null };
type SearchRow = { name: string; clicks: number; impressions: number; ctr: number | null; position: number | null };
type Section<T> = { status: "OK" | "NOT_CONFIGURED" | "UNAVAILABLE"; data: T | null; note: string | null };
type Traffic = {
  visitors: Metric; pageViews: Metric; sessions: Metric; signUps: Metric; trialStarts: Metric; signUpRate: number | null;
  daily: Array<{ date: string; visitors: number; pageViews: number }>;
  pages: Array<{ path: string; views: number; visitors: number }>;
  sources: Ranked[]; countries: Ranked[]; devices: Ranked[];
};
type Search = {
  clicks: Metric; impressions: Metric; ctr: number | null; position: number | null;
  daily: Array<{ date: string; clicks: number; impressions: number }>;
  queries: SearchRow[]; pages: SearchRow[]; countries: SearchRow[]; devices: SearchRow[];
};
export type WebsiteStatsReport = { range: Range; generatedAt: string; traffic: Section<Traffic>; search: Section<Search> };
export type LoadWebsiteStats = (days: Range, fresh: boolean) => Promise<WebsiteStatsReport>;

const RANGES: Range[] = [7, 28, 90];
const count = new Intl.NumberFormat("en");

const num = (value: number | null | undefined) => (value === null || value === undefined ? "—" : count.format(value));
const pct = (value: number | null, digits = 1) => (value === null ? "—" : `${(value * 100).toFixed(digits)}%`);
const change = (value: number | null) => (value === null ? "no earlier figure" : `${value >= 0 ? "+" : ""}${Math.round(value * 100)}% vs the period before`);

function Card({ label, metric, note }: { label: string; metric?: Metric; note?: string }) {
  return <div className="stat-card"><small>{label}</small><strong>{num(metric?.value)}</strong><span>{metric ? change(metric.change) : note}</span></div>;
}

/** A plain bar chart in SVG: a gap in the data is a gap, and the same figures are listed in a table below it. */
function Bars({ title, points }: { title: string; points: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const width = 720;
  const height = 150;
  const step = width / Math.max(1, points.length);
  return <div className="ws-chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}: ${points.map((p) => `${p.label} ${p.value}`).join(", ")}`} preserveAspectRatio="none">
      {points.map((p, i) => { const h = Math.max(p.value > 0 ? 2 : 0, (p.value / max) * (height - 14)); return <rect key={p.label} x={i * step + 1} y={height - h} width={Math.max(1, step - 2)} height={h} rx="2"><title>{`${p.label}: ${num(p.value)}`}</title></rect>; })}
    </svg>
    <div className="ws-axis"><span>{points[0]?.label}</span><span>{title} (most in one day: {num(max)})</span><span>{points[points.length - 1]?.label}</span></div>
  </div>;
}

function Table({ head, rows }: { head: string[]; rows: Array<Array<string | number>> }) {
  return <div className="table-wrap"><table className="ws-table"><thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
    <tbody>{rows.length === 0 ? <tr><td colSpan={head.length}><small>Nothing recorded for this period.</small></td></tr> : rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>;
}

function Notice({ section, what }: { section: Section<unknown>; what: string }) {
  return <section className="panel"><div className="panel-title"><div><h3>{what}</h3><p>{section.status === "NOT_CONFIGURED" ? "Not set up yet" : "Could not be read"}</p></div><span className="badge neutral">{section.status === "NOT_CONFIGURED" ? "Not set up" : "Unavailable"}</span></div><p className="help-note">{section.note}</p></section>;
}

function TrafficView({ t }: { t: Traffic }) {
  const shareRows = (rows: Ranked[]) => rows.map((r) => [r.name, num(r.visitors), pct(r.share, 0)]);
  return <>
    <div className="stat-grid">
      <Card label="Visitors" metric={t.visitors} /><Card label="Page views" metric={t.pageViews} /><Card label="Sessions" metric={t.sessions} />
      <div className="stat-card"><small>Sign-ups</small><strong>{num(t.signUps.value)}</strong><span>{t.signUpRate === null ? "no visitors yet" : `${pct(t.signUpRate)} of visitors`} · {num(t.trialStarts.value)} trial starts</span></div>
    </div>
    <section className="panel"><div className="panel-title"><div><h3>Visitors per day</h3><p>Days with no visits count as zero.</p></div></div>
      <Bars title="Visitors per day" points={t.daily.map((d) => ({ label: d.date, value: d.visitors }))} /></section>
    <div className="ws-two">
      <section className="panel"><div className="panel-title"><h3>Top pages</h3></div><Table head={["Page", "Views", "Visitors"]} rows={t.pages.map((p) => [p.path, num(p.views), num(p.visitors)])} /></section>
      <section className="panel"><div className="panel-title"><h3>Where visitors come from</h3></div><Table head={["Source", "Visitors", "Share"]} rows={shareRows(t.sources)} /></section>
      <section className="panel"><div className="panel-title"><h3>Countries</h3></div><Table head={["Country", "Visitors", "Share"]} rows={shareRows(t.countries)} /></section>
      <section className="panel"><div className="panel-title"><h3>Devices</h3></div><Table head={["Device", "Visitors", "Share"]} rows={shareRows(t.devices)} /></section>
    </div>
  </>;
}

function SearchView({ s }: { s: Search }) {
  const rows = (list: SearchRow[]) => list.map((r) => [r.name, num(r.clicks), num(r.impressions), pct(r.ctr), r.position === null ? "—" : r.position.toFixed(1)]);
  const head = (first: string) => [first, "Clicks", "Impressions", "Click rate", "Avg. position"];
  return <>
    <div className="stat-grid">
      <Card label="Search clicks" metric={s.clicks} /><Card label="Search impressions" metric={s.impressions} />
      <div className="stat-card"><small>Click rate</small><strong>{pct(s.ctr)}</strong><span>clicks per impression</span></div>
      <div className="stat-card"><small>Average position</small><strong>{s.position === null ? "—" : s.position.toFixed(1)}</strong><span>1 is the top of the results</span></div>
    </div>
    <section className="panel"><div className="panel-title"><div><h3>Search clicks per day</h3><p>Search Console runs about two days behind.</p></div></div>
      <Bars title="Search clicks per day" points={s.daily.map((d) => ({ label: d.date, value: d.clicks }))} /></section>
    <div className="ws-two">
      <section className="panel"><div className="panel-title"><h3>What people searched for</h3></div><Table head={head("Query")} rows={rows(s.queries)} /></section>
      <section className="panel"><div className="panel-title"><h3>Pages found in search</h3></div><Table head={head("Page")} rows={rows(s.pages)} /></section>
      <section className="panel"><div className="panel-title"><h3>Search by country</h3></div><Table head={head("Country")} rows={rows(s.countries)} /></section>
      <section className="panel"><div className="panel-title"><h3>Search by device</h3></div><Table head={head("Device")} rows={rows(s.devices)} /></section>
    </div>
  </>;
}

/** The website-visitors report: Google Analytics and Search Console figures for donordesk.online. It reads; it never changes anything. */
export function WebsiteStats({ load }: { load: LoadWebsiteStats }) {
  const [days, setDays] = useState<Range>(28);
  const [report, setReport] = useState<WebsiteStatsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const read = useCallback(async (fresh: boolean) => {
    setBusy(true);
    setError(null);
    try { setReport(await load(days, fresh)); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }, [days, load]);
  useEffect(() => { void read(false); }, [read]);

  return <div className="ws">
    <div className="ws-bar">
      <div className="ws-ranges" role="group" aria-label="Period">{RANGES.map((r) => <button key={r} className={r === days ? "selected" : ""} aria-pressed={r === days} onClick={() => setDays(r)}>Last {r} days</button>)}</div>
      <button className="ws-refresh" disabled={busy} onClick={() => void read(true)}>{busy ? "Loading…" : "Refresh"}</button>
    </div>
    <p className="ws-note">Counts only visitors who accepted analytics cookies on the public pages, so real traffic is higher. The signed-in product is never tracked. {report ? `Read ${new Date(report.generatedAt).toLocaleString()}; figures are kept for an hour.` : ""}</p>
    {error && <p className="test-result fail">{error}</p>}
    {!report && !error && <p className="muted">Loading…</p>}
    {report && <>
      {report.traffic.status === "OK" && report.traffic.data ? <TrafficView t={report.traffic.data} /> : <Notice section={report.traffic} what="Visitors (Google Analytics)" />}
      {report.search.status === "OK" && report.search.data ? <SearchView s={report.search.data} /> : <Notice section={report.search} what="Search (Google Search Console)" />}
    </>}
  </div>;
}
