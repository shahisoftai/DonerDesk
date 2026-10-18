import Link from "next/link";
import type { CSSProperties } from "react";
import Script from "next/script";
import { CookieConsentBanner } from "@/components/legal/CookieConsentBanner";
import { HomeFaq } from "@/components/landing/HomeFaq";
import { MarketingNav } from "@/components/landing/MarketingNav";
import { MarketingFooter } from "@/components/landing/MarketingFooter";
import { HomeHero } from "@/components/landing/home/HomeHero";
import { StageTabs } from "@/components/landing/home/StageTabs";
import styles from "@/components/landing/home/home.module.css";

const ROLES = [
  { name: "Field Officer", description: "Records activities and dictates them from the field." },
  { name: "Project Manager", description: "Reviews activities and tracks the work across the project." },
  { name: "M&E Officer", description: "Owns indicators, values and the Data Center." },
  { name: "Grants Officer", description: "Watches deadlines, readiness and donor requirements." },
  { name: "Compliance Officer", description: "Checks that claims are backed by evidence." },
  { name: "Admin", description: "Manages the workspace, members and plan." },
  { name: "Viewer", description: "Reads the record without changing it. Viewers do not use a seat." },
];

const PORTFOLIO = [
  { name: "Emergency Response: Health", status: "On track", tone: "pillOk", period: "Q3 report", percent: 83, ready: "Ready 92%", color: "var(--teal)" },
  { name: "WASH Recovery, Nigeria", status: "Review", tone: "pillWarn", period: "Semi-annual", percent: 61, ready: "Ready 61%", color: "var(--saffron)" },
  { name: "Girls' Education Pilot", status: "Gap", tone: "pillOpen", period: "Activity records", percent: 38, ready: "38%", color: "var(--sky)" },
] as const;

const LOOP_STEPS = [
  { label: "Q1", title: "Set the baseline", description: "Indicators, targets and team are fixed once and reused in every period.", color: "var(--teal)" },
  { label: "Q2", title: "Record as you go", description: "Activities and values are entered where the work happens, in the period their date falls in.", color: "var(--saffron)" },
  { label: "Q3", title: "Correct the course", description: "Gaps show in the Data Center while there is still time to act, not after the grant closes.", color: "var(--sky)" },
  { label: "Q4", title: "Report from the record", description: "The donor report is drafted from the same data, with each claim traced to its source.", color: "var(--coral)" },
] as const;

const TRIALS_ENABLED = process.env.NEXT_PUBLIC_TRIALS_ENABLED === "1";

const PLANS = [
  {
    code: "STARTER",
    name: "Starter",
    monthly: "$0",
    annual: "$0",
    tagline: "For small organizations managing their first funded programme.",
    cta: { label: "Start free", href: "/signup" },
    highlight: false,
    features: [
      "1 active project + unlimited archived",
      "1 seat + 2 read-only viewers",
      "1 GB managed storage",
      "5 successful AI report drafts / month",
      "Evidence vault, provenance & audit trail",
      "Community support",
    ],
  },
  {
    code: "TEAM",
    name: "Team",
    monthly: "$79",
    annual: "$790",
    tagline: "For growing teams reporting across several grants or projects.",
    cta: { label: "Continue", href: "/signup?plan=team" },
    highlight: true,
    features: [
      "5 active projects + unlimited archived",
      "5 full seats + unlimited viewers",
      "25 GB managed storage",
      "20 successful AI report drafts / month",
      "AI donor-template extraction",
      "AI credit top-ups (+50 for $79)",
      TRIALS_ENABLED ? "14-day free trial" : "",
      "Email support",
      "NGO price: $59.25/mo (verified 25% welcome discount, first year)",
    ].filter(Boolean),
  },
  {
    code: "GROWTH",
    name: "Growth",
    monthly: "$149",
    annual: "$1,490",
    tagline: "For organizations with multiple funders and substantial reporting volume.",
    cta: { label: "Continue", href: "/signup?plan=growth" },
    highlight: false,
    features: [
      "20 active projects",
      "15 full seats + unlimited viewers",
      "100 GB managed storage",
      "100 successful AI report drafts / month",
      "Bring your own AI provider",
      "AI credit top-ups (+100 for $149)",
      TRIALS_ENABLED ? "14-day free trial" : "",
      "Soft overage instead of a hard stop",
      "Priority email support + onboarding call",
      "NGO price: $111.75/mo (verified 25% welcome discount, first year)",
    ].filter(Boolean),
  },
  {
    code: "ENTERPRISE",
    name: "Enterprise",
    monthly: "Custom",
    annual: "From $12k / year",
    tagline: "For INGOs, research institutions, public bodies, and multi-country programmes.",
    cta: { label: "Contact us", href: "/contact-sales" },
    highlight: false,
    features: [
      "Unlimited projects & seats",
      "Contractual storage & AI credits",
      "SSO / SCIM",
      "Custom data residency",
      "SLA & dedicated support",
      "Procurement & security review support",
    ],
  },
];

export default function HomePage() {
  return (
    <main className={styles.home}>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400;1,6..72,500&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
      />
      <MarketingNav />

      <HomeHero />

      {/* Statement and pillars */}
      <section className={`${styles.band} ${styles.tint} ${styles.edge}`}>
        <div className={styles.wrap}>
          <p className={styles.statement}>
            Know where your programme stands <em>before</em> the donor asks.
          </p>
          <div className={styles.pillars}>
            <article className={styles.pillar}>
              <h3>Plan what matters</h3>
              <p>Set the logframe once. Give each person the activities, indicators and evidence their role needs, and see what is due this week.</p>
            </article>
            <article className={styles.pillar}>
              <h3>See it while it can change</h3>
              <p>Every indicator value sits in one sheet across all periods, against its own target, so progress is visible before a deadline forces it.</p>
            </article>
            <article className={styles.pillar}>
              <h3>Prove it when it counts</h3>
              <p>Files stay linked to the activity or indicator they prove. Every change is in an audit log, so anyone can check what was recorded and by whom.</p>
            </article>
          </div>
        </div>
      </section>

      {/* The programme cycle */}
      <section id="how-it-works" className={styles.band}>
        <div className={styles.wrap}>
          <div className={styles.stagesHead}>
            <div>
              <p className={styles.eyebrow}>The programme cycle</p>
              <h2>
                Plan it. Deliver it. Measure it. <em>Prove it.</em>
              </h2>
            </div>
            <p className={styles.lede}>
              Every stage draws on the same records, so the work you log today is the evidence you need at the end.
            </p>
          </div>
          <StageTabs />
        </div>
      </section>

      {/* Each cycle starts from the last */}
      <section className={`${styles.band} ${styles.tint} ${styles.edge}`}>
        <div className={`${styles.wrap} ${styles.loop}`}>
          <div>
            <p className={styles.eyebrow}>Why it compounds</p>
            <h2>
              Each cycle <em>starts</em> from the last one
            </h2>
            <p className={styles.lede}>
              The indicators, activities and evidence from one period carry into the next. Each period starts from what is
              already recorded, so the next report begins where the last one left off.
            </p>
          </div>
          <div>
            {LOOP_STEPS.map((step) => (
              <div key={step.label} className={styles.step} style={{ "--c": step.color } as CSSProperties}>
                <span className={styles.dotBadge}>{step.label}</span>
                <div>
                  <h4>{step.title}</h4>
                  <p>{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reporting, as one outcome */}
      <section id="reporting" className={styles.band}>
        <div className={`${styles.wrap} ${styles.report}`}>
          <div className={styles.doc} aria-label="Example draft section">
            <span className={styles.stamp}>Draft</span>
            <h3 className={styles.docTitle}>Progress against outcome 1</h3>
            <p className={styles.docMeta}>Section drafted from the programme record · Example</p>
            <p>
              Between July and September, 1,240 children were vaccinated against a target of 1,500, or 83 percent of target for the
              period <span className={styles.cite}>[ind. V-01]</span>. Mobile clinics ran in 38 of 41 planned outreach visits{" "}
              <span className={styles.cite}>[act. 38/41]</span>.
            </p>
            <p>
              Attendance was lowest in Ward 4 during the flooding in August, when two of the planned clinics could not reach the
              community <span className={styles.cite}>[ev. field log]</span>.
            </p>
          </div>
          <div>
            <p className={styles.eyebrow}>Reporting</p>
            <h2>
              A donor asks. <em>The answer is already in the record.</em>
            </h2>
            <p className={styles.lede}>
              Reports are assembled from the record, not rebuilt from it. Every number traces to a verified value, and every
              statement links to the activity, indicator or file behind it.
            </p>
            <div className={styles.checks}>
              <div className={styles.check}>
                <span className={styles.checkMark} aria-hidden="true">●</span>
                <div>
                  <b>Numbers come from the record</b>
                  A figure that is not in the inputs is rejected before the draft is shown.
                </div>
              </div>
              <div className={styles.check}>
                <span className={styles.checkMark} aria-hidden="true">●</span>
                <div>
                  <b>Claims are checked</b>
                  Statements are compared with their evidence and with the project&apos;s own records.
                </div>
              </div>
              <div className={styles.check}>
                <span className={styles.checkMark} aria-hidden="true">●</span>
                <div>
                  <b>A person approves</b>
                  Nothing is submitted until the responsible person signs it off.
                </div>
              </div>
            </div>
            <p className={styles.linkRow}>
              <Link href="/features">See every feature, with its limits →</Link>
            </p>
          </div>
        </div>
      </section>

      {/* Portfolio */}
      <section id="portfolio" className={`${styles.band} ${styles.tint} ${styles.edge}`}>
        <div className={styles.wrap}>
          <p className={styles.eyebrow}>Built for the whole portfolio</p>
          <h2>
            Every grant <em>kept in its own record</em>
          </h2>
          <p className={styles.lede}>
            Each grant is its own project with its own logframe, team and reports. Your plan sets how many you can run at once.
          </p>
          <div className={styles.portfolio}>
            {PORTFOLIO.map((project) => (
              <article key={project.name} className={styles.proj} style={{ "--c": project.color } as CSSProperties}>
                <div className={styles.projTop}>
                  <h3>{project.name}</h3>
                  <span className={`${styles.pill} ${styles[project.tone]}`}>{project.status}</span>
                </div>
                <div className={styles.meter} aria-hidden="true">
                  <i style={{ width: `${project.percent}%` }} />
                </div>
                <div className={styles.projMeta}>
                  <span>{project.period}</span>
                  <span>{project.ready}</span>
                </div>
              </article>
            ))}
          </div>
          <p className={styles.small} style={{ marginTop: 22 }}>Example projects for illustration.</p>
        </div>
      </section>

      {/* Roles */}
      <section id="who-its-for" className={styles.band}>
        <div className={styles.wrap}>
          <p className={styles.eyebrow}>Who uses it</p>
          <h2>
            Each person&apos;s part, <em>in one</em> record
          </h2>
          <div className={styles.roles}>
            {ROLES.map((role) => (
              <div key={role.name} className={styles.role}>
                <b>{role.name}</b>
                <span>{role.description}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className={`${styles.band} ${styles.tint} ${styles.edge}`}>
        <div className={styles.wrap}>
          <p className={styles.eyebrow}>Pricing</p>
          <h2>
            Start with one project. <em>Grow</em> with the portfolio.
          </h2>
          <div className={styles.priceGrid}>
            {PLANS.map((plan) => (
              <article key={plan.code} className={`${styles.plan} ${plan.highlight ? styles.planFeatured : ""}`}>
                {plan.highlight && <span className={styles.planBadge}>Most popular</span>}
                <h3>{plan.name}</h3>
                <p className={styles.planTagline}>{plan.tagline}</p>
                <p className={styles.price}>
                  {plan.monthly}
                  {plan.code !== "ENTERPRISE" && <small> / month</small>}
                </p>
                {plan.code !== "ENTERPRISE" && <p className={styles.small}>or {plan.annual} / year (2 months free)</p>}
                <ul className={styles.planList}>
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <Link
                  href={plan.cta.href}
                  className={`${styles.btn} ${plan.highlight ? styles.btnPrimary : styles.btnGhost}`}
                >
                  {plan.cta.label}
                </Link>
              </article>
            ))}
          </div>
          <p className={styles.priceNote}>
            Verified nonprofits get 25% off Team and Growth for their first year; nonprofit pricing for Enterprise is built into the
            contract. Tax is calculated at checkout where applicable. Annual billing gives two months free. Regional pricing for
            eligible organizations in lower-income countries is available on request.{" "}
            <Link href="/pricing">See the full plan comparison →</Link>
          </p>
        </div>
      </section>

      {/* Trust */}
      <section id="security" className={styles.band}>
        <div className={`${styles.wrap} ${styles.split}`}>
          <div>
            <p className={styles.eyebrow}>Trust</p>
            <h2>
              Your records stay <em>yours</em>
            </h2>
          </div>
          <div>
            <p className={styles.body}>
              Each organisation&apos;s data is isolated from every other tenant at the database level. The audit log is
              hash-chained, so an edit to history is detectable.
            </p>
            <p className={styles.body}>
              Stored AI outputs keep the model and prompt version used to write them. The Data Processing Agreement and
              subprocessor list are published before you sign up.
            </p>
            <p className={styles.body}>
              DonorDesk does not hold external certifications. We say so, and we will not claim one until it is in place.
            </p>
            <p className={styles.linkRow}>
              <Link href="/security">Read the security page →</Link>
            </p>
          </div>
        </div>
      </section>

      <HomeFaq />

      {/* Final call to action */}
      <section className={`${styles.band} ${styles.final} ${styles.edge}`}>
        <div className={styles.wrap}>
          <p className={styles.eyebrow}>Start today</p>
          <h2>
            Stop rebuilding the programme <em>every quarter.</em>
          </h2>
          <div className={styles.btns}>
            <Link href="/signup" className={`${styles.btn} ${styles.btnPrimary}`}>
              Create a free workspace
            </Link>
            <Link href="/tour" className={`${styles.btn} ${styles.btnGhost}`}>
              Take the product tour
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
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
    </main>
  );
}
