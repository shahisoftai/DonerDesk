import type { Metadata } from "next";
import Link from "next/link";
import { CookieConsentBanner } from "@/components/legal/CookieConsentBanner";
import { SiteShell } from "@/components/site/SiteShell";
import { SiteFooter } from "@/components/site/SiteFooter";

export const metadata: Metadata = {
  alternates: { canonical: "/platform" },
  title: "The platform",
  description: "How DonorDesk fits together: plan, collect, track, see, prove and report from one record, with the people, partners and tools around it.",
};

const JOBS: Array<{ key: string; title: string; promise: string; points: string[]; links: Array<{ label: string; href: string }> }> = [
  { key: "Plan", title: "Plan what matters", promise: "Set the targets and the work once, and every period starts from them.",
    points: ["Logframe with goals, outcomes, outputs, activities and indicators; import from Excel, CSV or text", "Baselines, targets, scheduled targets and group targets; indicators calculated from others", "Work plan with timeline, calendar, milestones and a map of where the work happens", "Risks, changes of plan, programmes and grants, and donor requirements"],
    links: [{ label: "Logframe and indicators", href: "/features#logframe" }, { label: "Work plan and timeline", href: "/features#workplan" }, { label: "Risks and changes of plan", href: "/features#risks" }] },
  { key: "Collect", title: "Collect it where the work happens", promise: "Field teams record once, with or without a signal.",
    points: ["Forms with rules, photo and document questions and GPS, and public links", "A field app that works offline and sends when the signal returns", "KoboToolbox and SurveyCTO submissions brought in as records you review", "An entry sheet that takes a paste from Excel, with autosave and an offline queue"],
    links: [{ label: "Collection forms", href: "/features#forms" }, { label: "Field app and offline use", href: "/features#field-app" }, { label: "The Entry Sheet", href: "/features#entry-sheet" }] },
  { key: "Track", title: "Track every indicator against its target", promise: "Gaps show while there is still time to act.",
    points: ["Every value in one place across all periods, with its status from draft to verified", "Entry windows, period submission and a send-back with a reason", "Results by place, with places kept as master data", "Gaps shown as gaps and never as zero; rates never added together"],
    links: [{ label: "Data Center", href: "/features#data-center" }, { label: "Places and results by place", href: "/features#places" }, { label: "Indicator views", href: "/features#report-builder" }] },
  { key: "See", title: "See it your way, and show it to others", promise: "The chart, map or page your board or donor asked for.",
    points: ["Chart Studio with 39 chart types and full editing", "Dashboards from sector templates, in tabs, full screen for the wall, and print", "Maps, KML and GeoJSON downloads, and a report builder that answers a question in one sentence", "One-page infographics and read-only share links for funders and supporters"],
    links: [{ label: "Chart Studio", href: "/features#chart-studio" }, { label: "Dashboards and templates", href: "/features#sector-dashboards" }, { label: "Infographic Studio", href: "/features#infographics" }] },
  { key: "Prove", title: "Prove it when it counts", promise: "Every number can be traced, and every change is on record.",
    points: ["Evidence linked to the activity or value it proves, with confidentiality levels", "A tamper-evident audit log, and approved figures that cannot change under a report", "Roles per project, a second-approver rule and outside partners limited to named projects", "Two-step sign-in an administrator can require, and row-level data isolation"],
    links: [{ label: "Evidence library", href: "/features#evidence" }, { label: "Team and roles", href: "/features#team" }, { label: "Security and access", href: "/features#security" }] },
  { key: "Report", title: "Report from the record", promise: "Drafts that cite their sources, checked and approved by a person.",
    points: ["Upload a donor template once; sections, questions and word limits are extracted for review", "Drafts written from the record, with the source of each statement shown", "Claims checked against the record, readiness checklists and sealed submissions", "Word, PDF and Excel exports, an evidence pack, and a management report"],
    links: [{ label: "Donor templates", href: "/features#templates" }, { label: "Sourced AI drafting", href: "/features#drafting" }, { label: "Review, approval and export", href: "/features#approval" }] },
];

export default function PlatformPage() {
  return (
    <SiteShell footer={<SiteFooter />}>
      <section className="sx-hero" style={{ paddingBottom: 24 }}>
        <div className="sx-wrap">
          <p className="sx-eyebrow">The platform</p>
          <h1 style={{ marginTop: 14, fontSize: "clamp(34px,4.6vw,56px)", fontWeight: 800, maxWidth: "22ch" }}>One record from the first target to the final report.</h1>
          <p className="sx-lede" style={{ marginTop: 16 }}>DonorDesk is six jobs on one record: plan, collect, track, see, prove and report. Nothing is typed twice, and each person sees the part they need. This page shows how the jobs fit together. For every feature and its limits, see the <Link href="/features" className="sx-link">full feature list</Link>.</p>
          <div className="sx-cta-row">
            <Link className="sx-btn sx-primary" href="/signup">Create a free workspace</Link>
            <Link className="sx-btn sx-ghost" href="/tour">Take the product tour</Link>
            <Link className="sx-btn sx-ghost" href="/features">See every feature</Link>
          </div>
        </div>
      </section>

      <section className="sx-band" style={{ paddingBlock: 28 }}>
        <div className="sx-wrap">
          <ol className="sx-flowrow" aria-label="The six jobs">
            {JOBS.map((j, i) => <li key={j.key}><a href={`#${j.key.toLowerCase()}`}><span>{i + 1}</span>{j.key}</a></li>)}
          </ol>
        </div>
      </section>

      <section>
        <div className="sx-wrap sx-stack" style={{ gap: 18 }}>
          {JOBS.map((j) => (
            <article key={j.key} id={j.key.toLowerCase()} className="sx-card sx-pj" style={{ scrollMarginTop: 96 }}>
              <div>
                <p className="sx-eyebrow">{j.key}</p>
                <h2 style={{ fontSize: "clamp(24px,3vw,32px)", fontWeight: 800, marginTop: 10 }}>{j.title}</h2>
                <p className="sx-lede" style={{ marginTop: 10, fontSize: 17 }}>{j.promise}</p>
              </div>
              <div>
                <ul className="sx-ticks" style={{ marginTop: 0 }}>{j.points.map((p) => <li key={p}>{p}</li>)}</ul>
                <p style={{ marginTop: 16, display: "flex", gap: "8px 18px", flexWrap: "wrap" }}>
                  {j.links.map((l) => <Link key={l.href} className="sx-link" href={l.href}>{l.label} →</Link>)}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="sx-band">
        <div className="sx-wrap sx-grid sx-g2" style={{ alignItems: "start" }}>
          <div className="sx-card">
            <h3>Works with the tools you already use</h3>
            <ul className="sx-ticks" style={{ marginTop: 12 }}>
              <li>KoboToolbox and SurveyCTO: bring submissions in as records you review.</li>
              <li>Excel, CSV and Google Sheets: import and export throughout.</li>
              <li>Google Drive: link files instead of copying them.</li>
              <li>A public read-only API, signed webhooks, and an MCP server for AI assistants.</li>
            </ul>
          </div>
          <div className="sx-card">
            <h3>Each person sees their part</h3>
            <ul className="sx-ticks" style={{ marginTop: 12 }}>
              <li>Directors see the portfolio; project managers see their projects.</li>
              <li>M&amp;E officers own indicators, forms and values.</li>
              <li>Field officers open on <b>My week</b>, on a phone, offline.</li>
              <li>Partners and boards read the record, and viewers do not use a paid seat.</li>
            </ul>
          </div>
        </div>
      </section>

      <section>
        <div className="sx-wrap">
          <div className="sx-final">
            <h2>See how it fits your programme.</h2>
            <p>Create a free workspace, or compare DonorDesk with the tools you may be using now.</p>
            <div className="sx-cta-row" style={{ justifyContent: "center", margin: 0 }}>
              <Link className="sx-btn sx-primary" href="/signup">Create a free workspace</Link>
              <Link className="sx-btn sx-ghost" href="/compare">See the comparison</Link>
            </div>
          </div>
        </div>
      </section>
      <CookieConsentBanner />
    </SiteShell>
  );
}
