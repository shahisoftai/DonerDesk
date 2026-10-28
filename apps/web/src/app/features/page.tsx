import type { Metadata } from "next";
import Link from "next/link";
import { CookieConsentBanner } from "@/components/legal/CookieConsentBanner";
import { SiteShell } from "@/components/site/SiteShell";
import { SiteFooter } from "@/components/site/SiteFooter";
import { FEATURE_GROUPS } from "@/components/landing/platform-content";

export const metadata: Metadata = {
  title: "Every feature",
  description:
    "Every DonorDesk feature in one place: logframe and indicators, work plan, field data collection and offline app, entry sheet, maps, evidence, Data Center, Chart Studio, dashboards, infographics, report builder, donor reporting, integrations and security. Each says who uses it and what to know before you rely on it.",
  alternates: { canonical: "/features" },
};

export default function FeaturesPage() {
  const all = FEATURE_GROUPS.flatMap((g) => g.features);
  return (
    <SiteShell footer={<SiteFooter />}>
      <section className="sx-hero" style={{ paddingBottom: 24 }}>
        <div className="sx-wrap">
          <p className="sx-crumbs"><Link href="/platform">Platform</Link> › <b>Every feature</b></p>
          <p className="sx-eyebrow" style={{ marginTop: 18 }}>Features</p>
          <h1 style={{ marginTop: 14, fontSize: "clamp(34px,4.6vw,56px)", fontWeight: 800, maxWidth: "22ch" }}>Every feature, and what to know before you rely on it.</h1>
          <p className="sx-lede" style={{ marginTop: 16 }}>{all.length} features across planning, field collection, reporting, insight and trust. Each says what it does, who uses it and its limits. For the short version, see <Link href="/platform" className="sx-link">how the platform fits together</Link>.</p>
          <div className="sx-cta-row">
            <Link className="sx-btn sx-primary" href="/signup">Create a free workspace</Link>
            <Link className="sx-btn sx-ghost" href="/tour">Take the product tour</Link>
          </div>
        </div>
      </section>

      <nav aria-label="Jump to a feature" className="sx-strip">
        <div className="sx-wrap sx-jump">
          {all.map((f) => <a key={f.id} href={`#${f.id}`}>{f.title}</a>)}
        </div>
      </nav>

      {FEATURE_GROUPS.map((group, gi) => (
        <section key={group.id} aria-labelledby={`group-${group.id}`} className={gi % 2 === 0 ? "" : "sx-band"}>
          <div className="sx-wrap">
            <div className="sx-sec-head">
              <p className="sx-eyebrow">{group.eyebrow}</p>
              <h2 id={`group-${group.id}`}>{group.title}</h2>
              <p className="sx-lede">{group.intro}</p>
            </div>
            <div className="sx-stack" style={{ gap: 16 }}>
              {group.features.map((f) => (
                <article key={f.id} id={f.id} className="sx-card sx-feature">
                  <div>
                    <h3 style={{ fontSize: 24 }}>{f.title}</h3>
                    <p style={{ marginTop: 8 }}>{f.summary}</p>
                    <p className="sx-fine"><b>Who uses it:</b> {f.who}</p>
                    <Link className="sx-more" href={f.supportHref}>Step-by-step guide →</Link>
                  </div>
                  <div>
                    <p className="sx-eyebrow">In practice</p>
                    <ul className="sx-ticks">
                      {f.inPractice.map((point) => <li key={point}>{point}</li>)}
                    </ul>
                    <p className="sx-notice"><b>Good to know.</b> {f.goodToKnow}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="sx-band">
        <div className="sx-wrap">
          <div className="sx-final">
            <h2>See it on your own programme.</h2>
            <p>Start a free workspace, or take the tour first. The demo project is included and uses no AI credits.</p>
            <div className="sx-cta-row" style={{ justifyContent: "center", margin: 0 }}>
              <Link className="sx-btn sx-primary" href="/signup">Create a free workspace</Link>
              <Link className="sx-btn sx-ghost" href="/pricing">Compare plans</Link>
            </div>
          </div>
        </div>
      </section>
      <CookieConsentBanner />
    </SiteShell>
  );
}
