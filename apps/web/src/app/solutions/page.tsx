import type { Metadata } from "next";
import Link from "next/link";
import { CookieConsentBanner } from "@/components/legal/CookieConsentBanner";
import { SiteShell } from "@/components/site/SiteShell";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SECTOR_PAGES } from "@/components/site/site-data";

export const metadata: Metadata = {
  alternates: { canonical: "/solutions" },
  title: "Solutions by sector",
  description: "See how DonorDesk fits water and sanitation, health, nutrition, education, food security and protection programmes.",
};

export default function SolutionsIndex() {
  return (
    <SiteShell footer={<SiteFooter />}>
      <section className="sx-hero" style={{ paddingBottom: 24 }}>
        <div className="sx-wrap">
          <p className="sx-eyebrow">Solutions</p>
          <h1 style={{ marginTop: 14, fontSize: "clamp(34px,4.6vw,56px)", fontWeight: 800, maxWidth: "22ch" }}>See it in the words of your own work.</h1>
          <p className="sx-lede" style={{ marginTop: 16 }}>Choose your sector to see the indicators, dashboards and reports a programme like yours uses. Every sector starts from an editable dashboard template.</p>
        </div>
      </section>
      <section style={{ paddingTop: 8 }}>
        <div className="sx-wrap sx-grid sx-g3">
          {SECTOR_PAGES.map((s) => (
            <div className="sx-card" key={s.slug}>
              <h3>{s.name}</h3>
              <p>{s.indicatorExample.charAt(0).toUpperCase() + s.indicatorExample.slice(1)}.</p>
              <Link className="sx-more" href={`/solutions/${s.slug}`}>See how it fits →</Link>
            </div>
          ))}
        </div>
      </section>
      <CookieConsentBanner />
    </SiteShell>
  );
}
