import type { Metadata } from "next";
import Link from "next/link";
import { CookieConsentBanner } from "@/components/legal/CookieConsentBanner";
import { SiteShell } from "@/components/site/SiteShell";
import { SiteFooter } from "@/components/site/SiteFooter";
import { CompareMatrix } from "@/components/site/CompareMatrix";
import { CHECKED } from "@/components/site/compare-data";

export const metadata: Metadata = {
  alternates: { canonical: "/compare" },
  title: "DonorDesk compared: ActivityInfo, DevResults, TolaData and KoboToolbox",
  description: "A feature-by-feature comparison of DonorDesk with ActivityInfo, DevResults, TolaData, KoboToolbox and spreadsheets, using only what each vendor states on its own site.",
};

export default function ComparePage() {
  return (
    <SiteShell footer={<SiteFooter />}>
      <section className="sx-hero" style={{ paddingBottom: 20 }}>
        <div className="sx-wrap">
          <p className="sx-eyebrow">Compare</p>
          <h1 style={{ marginTop: 14, fontSize: "clamp(34px,4.6vw,56px)", fontWeight: 800, maxWidth: "20ch" }}>How DonorDesk compares with what you may be using.</h1>
          <p className="sx-lede" style={{ marginTop: 16 }}>Different tools are built for different jobs. Below is a feature-by-feature comparison across planning, data collection, dashboards, reporting, evidence, access, integrations and security, using what each vendor states on its own website.</p>
          <p className="sx-notice">We compare only what each vendor publishes on its own website. We last read those pages on {CHECKED} and re-check them every quarter. If something here is out of date, <Link href="/contact-sales" className="sx-link">tell us</Link> and we will fix it.</p>
        </div>
      </section>

      <section style={{ paddingTop: 16 }}>
        <div className="sx-wrap sx-wrap-wide">
          <CompareMatrix />
          <p className="sx-fine" style={{ maxWidth: "120ch" }}>A grey cross means we did not find the feature on the pages we read, not that the tool lacks it. Prices and features change; check the vendor before you decide. Product names belong to their owners.</p>
        </div>
      </section>

      <section>
        <div className="sx-wrap">
          <div className="sx-sec-head"><p className="sx-eyebrow">What DonorDesk adds</p><h2>One record from the first target to the donor&apos;s question.</h2></div>
          <div className="sx-grid sx-g3">
            <div className="sx-card"><h3>Planning and results together</h3><p>The logframe, work plan, indicators, evidence and compliance sit in one record, with a role for each person who touches it.</p></div>
            <div className="sx-card"><h3>Reports drafted from the record</h3><p>Upload a donor template once. Drafts cite the activity or value behind each statement, checks run before submission, and a person approves.</p></div>
            <div className="sx-card"><h3>Charts, maps and shareable pages</h3><p>More than 40 chart types, sector dashboard templates, maps by place, and infographics and dashboards you can share by link.</p></div>
          </div>
        </div>
      </section>

      <section className="sx-band">
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

      <section>
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
