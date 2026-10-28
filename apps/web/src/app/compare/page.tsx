import type { Metadata } from "next";
import Link from "next/link";
import { CookieConsentBanner } from "@/components/legal/CookieConsentBanner";
import { SiteShell } from "@/components/site/SiteShell";
import { SiteFooter } from "@/components/site/SiteFooter";

export const metadata: Metadata = {
  alternates: { canonical: "/compare" },
  title: "How DonorDesk compares",
  description: "What spreadsheets, KoboToolbox, ActivityInfo, DevResults and TolaData are built for, what they cost where they say so, and when each is the better fit.",
};

/** Last time the vendors' public pages were read. Re-check every quarter; never state anything here the vendor's own page does not. */
const CHECKED = "28 October 2026";

const COLUMNS = ["DonorDesk", "Spreadsheets and email", "KoboToolbox", "ActivityInfo", "DevResults", "TolaData"] as const;

const ROWS: Array<{ label: string; cells: string[] }> = [
  { label: "What it says it is for", cells: [
    "Running a funded programme and reporting on it: plan, collect, track, prove and report in one record.",
    "Anything, one file at a time.",
    "Collecting survey data in the field. Free for humanitarian organisations, according to its documentation.",
    "An information management system for collecting, analysing and sharing data, including monitoring and evaluation, with online and offline collection.",
    "Monitoring and evaluation software for international development, with project maps and collaboration with donors and partners.",
    "An end-to-end solution for portfolio and project impact management: collect, configurable dashboards and a results framework.",
  ] },
  { label: "Price, as published", cells: [
    "Free plan. Team $79 a month, Growth $149 a month, Enterprise from $12,000 a year. Verified NGOs get 25% off the first year.",
    "Free.",
    "A free Community plan for nonprofits, plus paid Professional, Teams and Enterprise plans.",
    "Solo from €545 a year (one database); Programme from €3,700 a year; larger agreements by quote.",
    "A set-up fee plus an annual subscription by programme size: from $33,800 and $28,000 a year (up to $5M); unlimited user licences.",
    "Not shown on its website.",
  ] },
  { label: "How you start", cells: [
    "Create a workspace yourself, free, in minutes. An onboarding call comes with the Growth plan.",
    "Open a file.",
    "Sign up yourself.",
    "Guided onboarding is included in all plans, according to its pricing page.",
    "Vendor-led set-up and training, priced on its pricing page.",
    "Not stated on its website.",
  ] },
];

export default function ComparePage() {
  return (
    <SiteShell footer={<SiteFooter />}>
      <section className="sx-hero" style={{ paddingBottom: 20 }}>
        <div className="sx-wrap">
          <p className="sx-eyebrow">Compare</p>
          <h1 style={{ marginTop: 14, fontSize: "clamp(34px,4.6vw,56px)", fontWeight: 800, maxWidth: "20ch" }}>How DonorDesk compares with what you may be using.</h1>
          <p className="sx-lede" style={{ marginTop: 16 }}>Different tools are built for different jobs. This page says what each one says it is for, what it costs where the vendor publishes a price, and when it is the better fit.</p>
          <p className="sx-notice">We compare only what each vendor publishes on its own website. We last read those pages on {CHECKED} and re-check them every quarter. If something here is out of date, <Link href="/contact-sales" className="sx-link">tell us</Link> and we will fix it.</p>
        </div>
      </section>

      <section style={{ paddingTop: 16 }}>
        <div className="sx-wrap">
          <div className="sx-cmp-wrap" tabIndex={0} aria-label="Comparison table, scrolls sideways on small screens">
            <table className="sx-cmp">
              <thead>
                <tr><th scope="col"><span className="sx-sr">Question</span></th>{COLUMNS.map((c, i) => <th key={c} scope="col" className={i === 0 ? "sx-us" : undefined}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.label}><th scope="row">{r.label}</th>{r.cells.map((c, i) => <td key={i} className={i === 0 ? "sx-us" : undefined}>{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="sx-fine">Sources: each vendor&apos;s public website and pricing page, and KoboToolbox&apos;s published documentation and plan announcement. Prices are the vendors&apos; own and may have changed. Product names belong to their owners.</p>
        </div>
      </section>

      <section className="sx-band">
        <div className="sx-wrap">
          <div className="sx-sec-head"><p className="sx-eyebrow">What DonorDesk adds</p><h2>One record from the first target to the donor&apos;s question.</h2></div>
          <div className="sx-grid sx-g3">
            <div className="sx-card"><h3>Planning and results together</h3><p>The logframe, work plan, indicators, evidence and compliance sit in one record, with a role for each person who touches it.</p></div>
            <div className="sx-card"><h3>Reports drafted from the record</h3><p>Upload a donor template once. Drafts cite the activity or value behind each statement, checks run before submission, and a person approves.</p></div>
            <div className="sx-card"><h3>Charts, maps and shareable pages</h3><p>More than 40 chart types, sector dashboard templates, maps by place, and infographics and dashboards you can share by link.</p></div>
          </div>
        </div>
      </section>

      <section>
        <div className="sx-wrap">
          <div className="sx-sec-head"><p className="sx-eyebrow">Which fits</p><h2>When another tool is the better choice, we say so.</h2></div>
          <div className="sx-grid sx-g2">
            <div className="sx-card sx-fit"><h3>A spreadsheet is enough when…</h3><p>You run one small project, one person keeps the numbers, and a single donor asks for a simple report. When you add a second donor or a second person, the rebuilding starts.</p></div>
            <div className="sx-card sx-fit"><h3>KoboToolbox is the right tool when…</h3><p>You only need to collect survey data. Keep using it. DonorDesk brings its submissions in as records you review, so collection stays where it is strongest.</p></div>
            <div className="sx-card sx-fit"><h3>A vendor-led platform fits when…</h3><p>You are a large programme that wants a bespoke set-up and hands-on training, and has budgeted for it. DonorDesk is self-serve and priced for teams that want to start this week.</p></div>
            <div className="sx-card sx-fit"><h3>DonorDesk fits when…</h3><p>You want planning, field data, results, evidence and donor reports in one record, you report to more than one funder, and you want to see where you stand before they ask.</p></div>
          </div>
        </div>
      </section>

      <section className="sx-band">
        <div className="sx-wrap">
          <div className="sx-final">
            <h2>Try it with your own project.</h2>
            <p>Create a free workspace and bring a real grant. Move your data in with Excel.</p>
            <div className="sx-cta-row" style={{ justifyContent: "center", margin: 0 }}>
              <Link className="sx-btn sx-primary" href="/signup">Create a free workspace</Link>
              <Link className="sx-btn sx-ghost" href="/tour">Take the product tour</Link>
            </div>
          </div>
        </div>
      </section>
      <CookieConsentBanner />
    </SiteShell>
  );
}
