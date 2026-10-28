import Link from "next/link";
import Script from "next/script";
import { CookieConsentBanner } from "@/components/legal/CookieConsentBanner";
import { SiteShell } from "@/components/site/SiteShell";
import { SiteFooter } from "@/components/site/SiteFooter";
import { FieldFlow } from "@/components/site/FieldFlow";
import { Hero, SectorProvider, StudioDemo } from "@/components/site/SectorStage";
import { SECTOR_PAGES, SOUND_FAMILIAR } from "@/components/site/site-data";
import { homePlans } from "@/components/site/plans";

const JOBS = [
  { key: "Plan", title: "Plan what matters", points: ["Logframe, indicators and targets, set once", "Work plan with timeline, calendar and map", "Risks and changes of plan on record"], wide: false },
  { key: "Collect", title: "Collect it in the field", points: ["Forms and activity records, typed or dictated", "Offline app that sends when signal returns", "KoboToolbox, SurveyCTO and Excel brought in"], wide: false },
  { key: "Track", title: "Track against targets", points: ["A spreadsheet-style sheet for entering results", "Every indicator against its own target", "Gaps shown as gaps, never as zero"], wide: false },
  { key: "See", title: "See it your way", points: ["Chart Studio with more than 40 chart types and full editing", "Dashboards from sector templates, then make them yours", "Maps by place, wall-screen mode and print"], wide: true },
  { key: "Prove", title: "Prove it when it counts", points: ["Evidence stays linked to what it proves", "Every change is in a tamper-evident log", "Confidential files stay confidential"], wide: true },
  { key: "Report", title: "Report from the record", points: ["Upload a donor template once and reuse it across grants", "Drafts cite their sources; numbers come from verified data", "Checks before submission; a person approves and exports"], wide: false, full: true },
] as const;

const ROLES = [
  { face: "D", name: "Directors", text: "The whole portfolio at a glance: what is late, what is on target, what the funder will ask next." },
  { face: "P", name: "Project managers", text: "Plan the work, review activities, watch delivery and sign off the report." },
  { face: "M", name: "M&E officers", text: "Own the indicators, forms and values. Enter results in a sheet, build charts and reports." },
  { face: "G", name: "Grants and compliance", text: "Deadlines, readiness, donor requirements, and claims backed by evidence." },
  { face: "F", name: "Field officers", text: "Record activities and fill forms on a phone, offline, or by dictating." },
  { face: "V", name: "Partners and boards", text: "Read the record without changing it. Viewers do not use a paid seat." },
];

const FAQ = [
  { q: "Is DonorDesk a fundraising tool?", a: "It helps you show results to supporters and funders: infographics, shareable dashboards and reports drawn from verified results. It does not hold donor records or take payments. If you need a donor database, keep yours and use DonorDesk for the programme side." },
  { q: "Does the AI write our reports?", a: "It drafts sections from your own record and cites the source of each statement. Numbers come from verified data, claims are checked, and a person approves before anything is exported." },
  { q: "Can we use it where there is no internet?", a: "Yes. The field app keeps forms and activity records on the phone and sends them when a connection returns." },
  { q: "Can we bring our KoboToolbox or SurveyCTO data?", a: "Yes. Submissions come in as records you review before they count, and Excel imports work throughout." },
  { q: "What happens to our data if we stop?", a: "You keep it. Export everything, including files, whenever you like." },
];

export default function HomePage() {
  return (
    <SiteShell footer={<SiteFooter />}>
      <SectorProvider>
        <Hero />

        <div className="sx-strip">
          <div className="sx-wrap sx-strip-grid">
            <div className="sx-facts"><span>Free plan, no card</span><span>Works offline in the field</span><span>Export everything, any time</span><span>A person approves every report</span></div>
          </div>
        </div>

        <section className="sx-sound sx-band" id="sound">
          <div className="sx-wrap">
            <div className="sx-sec-head"><p className="sx-eyebrow">Sound familiar?</p><h2>The work is real. The paperwork should not be the hard part.</h2></div>
            <div className="sx-grid sx-g5">
              {SOUND_FAMILIAR.map((q) => <div className="sx-card" key={q}><q>{q}</q></div>)}
            </div>
          </div>
        </section>

        <section id="platform">
          <div className="sx-wrap">
            <div className="sx-sec-head"><p className="sx-eyebrow">One record, six jobs</p><h2>Everything a funded programme needs, from first target to final report.</h2><p className="sx-lede">Each job opens into the detail. All of it works from the same record, so nothing is typed twice.</p></div>
            <div className="sx-grid sx-jobs">
              {JOBS.map((j) => (
                <article key={j.key} className={`sx-card sx-job${"wide" in j && j.wide ? " sx-wide" : ""}${"full" in j && j.full ? " sx-full" : ""}`}>
                  <span className="sx-k">{j.key}</span>
                  <h3>{j.title}</h3>
                  <ul>{j.points.map((p) => <li key={p}>{p}</li>)}</ul>
                </article>
              ))}
            </div>
            <p style={{ marginTop: 20 }}><Link className="sx-link" href="/platform">See how the platform fits together →</Link></p>
          </div>
        </section>

        <section className="sx-band" id="studio">
          <div className="sx-wrap">
            <div className="sx-sec-head"><p className="sx-eyebrow">See it your way</p><h2>Ask a question of your own results. Get a chart a donor can read.</h2><p className="sx-lede">Try it with the sector you chose above. Every chart is drawn from recorded results, and a chart that would mislead says why instead of drawing.</p></div>
            <StudioDemo />
          </div>
        </section>

        <section id="flow">
          <div className="sx-wrap">
            <div className="sx-sec-head"><p className="sx-eyebrow">From the field to the donor</p><h2>A number is recorded once. Everything else follows from it.</h2></div>
            <FieldFlow />
          </div>
        </section>

        <section className="sx-band" id="supporters">
          <div className="sx-wrap sx-sup">
            <div>
              <p className="sx-eyebrow">Show supporters what their gift did</p>
              <h2 style={{ fontSize: "clamp(30px,4vw,46px)", fontWeight: 800, marginTop: 14 }}>Turn results into a page your supporters want to share.</h2>
              <p className="sx-lede" style={{ marginTop: 16 }}>Make a one-page infographic from your verified results, in your colours and your language. Share it as a link or put it on your website. Use it in campaign updates and donor newsletters, and let funders see progress without waiting for the report.</p>
              <ul style={{ color: "var(--muted)", paddingInlineStart: 20, marginTop: 14 }}>
                <li>Figures come from the record, so they match the report</li>
                <li>English, French, Spanish and Arabic layouts</li>
                <li>Links expire and can be withdrawn</li>
              </ul>
              <p className="sx-notice">DonorDesk helps you show results to supporters. It is not a donor database or a payment tool.</p>
            </div>
            <div className="sx-infog" aria-label="Example infographic">
              <span className="sx-eyebrow">Example · Health programme, first half-year</span>
              <div><div className="sx-big">2,480</div><div style={{ fontWeight: 600 }}>children treated for malnutrition</div></div>
              <div className="sx-row3"><div><b>94%</b>recovered</div><div><b>31</b>clinics</div><div><b>6</b>districts</div></div>
              <svg viewBox="0 0 400 90" width="100%" aria-hidden="true"><path d="M0 76 60 66 120 60 180 44 240 40 300 24 400 10" fill="none" stroke="var(--brand)" strokeWidth="3.2" strokeLinecap="round" /><path d="M0 76 60 66 120 60 180 44 240 40 300 24 400 10V90H0Z" fill="var(--brand)" opacity=".12" /></svg>
              <div className="sx-share"><span>donordesk.online/shared/…</span><span className="sx-pill">Link expires</span></div>
            </div>
          </div>
        </section>

        <section id="roles">
          <div className="sx-wrap">
            <div className="sx-sec-head"><p className="sx-eyebrow">Who it is for</p><h2>Everyone sees the part of the record they need.</h2></div>
            <div className="sx-grid sx-g3">
              {ROLES.map((r) => <div className="sx-card sx-role" key={r.name}><span className="sx-face">{r.face}</span><h3>{r.name}</h3><p>{r.text}</p></div>)}
            </div>
          </div>
        </section>

        <section className="sx-band" id="solutions">
          <div className="sx-wrap">
            <div className="sx-sec-head"><p className="sx-eyebrow">By sector</p><h2>See it in the words of your own work.</h2></div>
            <div className="sx-grid sx-g3">
              {SECTOR_PAGES.map((s) => (
                <div className="sx-card" key={s.slug}><h3>{s.name}</h3><p>{s.indicatorExample.charAt(0).toUpperCase() + s.indicatorExample.slice(1)}.</p><Link className="sx-more" href={`/solutions/${s.slug}`}>See how it fits →</Link></div>
              ))}
            </div>
          </div>
        </section>

        <section id="trust">
          <div className="sx-wrap sx-grid sx-g2" style={{ alignItems: "start" }}>
            <div><p className="sx-eyebrow">Trust and control</p><h2 style={{ fontSize: "clamp(30px,4vw,46px)", fontWeight: 800, marginTop: 14 }}>Built for work that must stand up to a funder, an auditor and a security review.</h2></div>
            <div className="sx-card sx-trust">
              <ul>
                <li><b>Separate by design.</b> Each organisation&apos;s data is isolated in the database itself.</li>
                <li><b>Traceable.</b> Every change goes into a tamper-evident audit log.</li>
                <li><b>Controlled.</b> Roles per project, a second-approver rule, and outside partners limited to named projects.</li>
                <li><b>Protected.</b> Two-step sign-in that an administrator can require, and encryption options for stored files.</li>
                <li><b>Yours.</b> Export your data and leave any time.</li>
                <li><b>Plain about limits.</b> We hold no security certification today, and we say so.</li>
              </ul>
              <Link className="sx-link" href="/security" style={{ display: "inline-block", marginTop: 14 }}>Read the security page →</Link>
            </div>
          </div>
        </section>

        <section className="sx-band" id="pricing">
          <div className="sx-wrap">
            <div className="sx-sec-head"><p className="sx-eyebrow">Pricing</p><h2>Start free. Pay when the programme grows.</h2><p className="sx-lede">Verified NGOs get 25% off the first year.</p></div>
            <div className="sx-grid sx-plans">
              {homePlans().map((p) => (
                <div key={p.name} className={`sx-card sx-price${p.primary ? " sx-hi" : ""}`}>
                  <h3>{p.name}</h3>
                  <div className="sx-amt">{p.price} <small>{p.per}</small></div>
                  <p>{p.tagline}</p>
                  <ul>{p.points.map((x) => <li key={x}>{x}</li>)}</ul>
                  <Link className={`sx-btn ${p.primary ? "sx-primary" : "sx-ghost"}`} href={p.href} style={{ justifyContent: "center" }}>{p.cta}</Link>
                </div>
              ))}
            </div>
            <p className="sx-fine"><Link className="sx-link" href="/pricing">Compare every plan in detail →</Link></p>
          </div>
        </section>

        <section id="resources">
          <div className="sx-wrap">
            <div className="sx-sec-head"><p className="sx-eyebrow">Learn more</p><h2>Look around before you decide.</h2></div>
            <div className="sx-grid sx-g3">
              <div className="sx-card"><h3>Product tour</h3><p>Walk through a project from logframe to donor report, with no sign-up.</p><Link className="sx-more" href="/tour">Take the tour →</Link></div>
              <div className="sx-card"><h3>Support centre</h3><p>Step-by-step guides for every part of the product, written in plain words.</p><Link className="sx-more" href="/support">Open the guides →</Link></div>
              <div className="sx-card"><h3>How we compare</h3><p>What other tools are built for, what they cost where they say so, and when each is the better fit.</p><Link className="sx-more" href="/compare">See the comparison →</Link></div>
            </div>
          </div>
        </section>

        <section className="sx-band" id="faq">
          <div className="sx-wrap" style={{ maxWidth: 860 }}>
            <div className="sx-sec-head"><p className="sx-eyebrow">Questions</p><h2>What people ask before they start.</h2></div>
            {FAQ.map((f, i) => (
              <details key={f.q} open={i === 0}><summary>{f.q}</summary><p>{f.a}</p></details>
            ))}
          </div>
        </section>

        <section>
          <div className="sx-wrap">
            <div className="sx-final">
              <h2>See your own programme in DonorDesk.</h2>
              <p>Create a free workspace and bring a real grant, or book a 20-minute walkthrough.</p>
              <div className="sx-cta-row" style={{ justifyContent: "center", margin: 0 }}>
                <Link className="sx-btn sx-primary" href="/signup">Create a free workspace</Link>
                <Link className="sx-btn sx-ghost" href="/contact-sales">Book a walkthrough</Link>
              </div>
            </div>
          </div>
        </section>
      </SectorProvider>
      <CookieConsentBanner />
      <Script id="voxeleon-chat" strategy="afterInteractive">{`
        window.voxeleonSettings = {"position":"right","type":"standard","launcherTitle":""};
        (function(d,t){
          var BASE_URL="https://app.voxeleon.com";
          var g=d.createElement(t),s=d.getElementsByTagName(t)[0];
          g.src=BASE_URL+"/packs/js/voxeleon-sdk.js";
          g.async=true;
          s.parentNode.insertBefore(g,s);
          g.onload=function(){
            window.voxeleonSDK.run({websiteToken:'PiC3TqgB2V3xSYpE7M6Asz7G',baseUrl:BASE_URL});
          };
        })(document,"script");
      `}</Script>
    </SiteShell>
  );
}
