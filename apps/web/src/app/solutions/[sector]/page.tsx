import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/site/SiteShell";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SectorDashboard } from "@/components/site/charts";
import { SECTORS, SECTOR_PAGES } from "@/components/site/site-data";
import { headlineIndicators, sectorContent, type LibrarySectorId } from "@donordesk/domain";

/** The sector library behind each public page (Version 4.000, plan F89): the page lists the library's own headline indicators. */
const LIBRARY_SECTOR: Readonly<Record<string, LibrarySectorId>> = {
  wash: "WASH", health: "HEALTH", nutrition: "NUTRITION", education: "EDUCATION", "food-security": "FOOD_SECURITY", protection: "PROTECTION",
};

export function generateStaticParams() {
  return SECTOR_PAGES.map((s) => ({ sector: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ sector: string }> }): Promise<Metadata> {
  const { sector } = await params;
  const page = SECTOR_PAGES.find((s) => s.slug === sector);
  if (!page) return {};
  return { alternates: { canonical: `/solutions/${page.slug}` }, title: `${page.name} programmes`, description: page.metaDescription };
}

export default async function SectorPage({ params }: { params: Promise<{ sector: string }> }) {
  const { sector } = await params;
  const page = SECTOR_PAGES.find((s) => s.slug === sector);
  const example = SECTORS.find((s) => s.slug === sector);
  if (!page || !example) notFound();
  const librarySector = LIBRARY_SECTOR[page.slug];
  const library = librarySector ? sectorContent(librarySector) : null;
  const headline = library ? headlineIndicators(library).slice(0, 9) : [];
  return (
    <SiteShell footer={<SiteFooter />}>
      <section className="sx-hero" style={{ paddingBottom: 24 }}>
        <div className="sx-wrap">
          <p className="sx-crumbs"><Link href="/solutions">Solutions</Link> › <b>{page.name}</b></p>
          <div className="sx-hero-grid" style={{ marginTop: 18 }}>
            <div>
              <p className="sx-eyebrow">For {page.name.toLowerCase()} programmes</p>
              <h1 style={{ marginTop: 14, fontSize: "clamp(34px,4.6vw,56px)", fontWeight: 800 }}>{page.headline}</h1>
              <p className="sx-lede" style={{ marginTop: 18 }}>{page.lede}</p>
              <div className="sx-cta-row">
                <Link className="sx-btn sx-primary" href="/signup">Create a free workspace</Link>
                <Link className="sx-btn sx-ghost" href="/tour">Take the product tour</Link>
              </div>
              <p className="sx-fine">Start from an editable {page.name.toLowerCase()} dashboard template.</p>
            </div>
            <div className="sx-panel"><SectorDashboard sector={example} /></div>
          </div>
        </div>
      </section>

      <section className="sx-band">
        <div className="sx-wrap">
          <div className="sx-sec-head"><p className="sx-eyebrow">Three problems, handled</p><h2>What {page.name.toLowerCase()} teams tell us slows them down.</h2></div>
          <div className="sx-grid sx-g3">
            {page.problems.map((p) => <div className="sx-card" key={p.title}><h3>{p.title}</h3><p>{p.text}</p></div>)}
          </div>
          {page.note && <p className="sx-notice">{page.note}</p>}
        </div>
      </section>

      {headline.length > 0 && (
        <section>
          <div className="sx-wrap">
            <div className="sx-sec-head"><p className="sx-eyebrow">From the sector library</p><h2>Start with indicators {page.name.toLowerCase()} donors already ask for.</h2><p className="sx-lede">Pick them while setting up a project. Each comes with its definition and unit; you set the targets. {library ? `The library holds ${library.indicators.length} ${page.name.toLowerCase()} indicators.` : ""}</p></div>
            <div className="sx-grid sx-g3">
              {headline.map((i) => <div className="sx-card" key={i.id}><p className="sx-eyebrow" style={{ fontSize: 11 }}>{i.group}</p><h3 style={{ marginTop: 8 }}>{i.name}</h3><p>{i.definition}</p></div>)}
            </div>
            <p className="sx-notice">Library entries are starting points for your own logframe, reviewed by your team before use.</p>
          </div>
        </section>
      )}

      <section className="sx-band">
        <div className="sx-wrap">
          <div className="sx-sec-head"><p className="sx-eyebrow">A day in the life</p><h2>Two people, one record.</h2></div>
          <div className="sx-grid sx-g2">
            <div className="sx-card"><h3>The field officer</h3><p>Opens <b>My week</b> on a phone, records the day&apos;s activities and fills forms while offline. Everything sends when the signal returns.</p></div>
            <div className="sx-card"><h3>The M&amp;E officer</h3><p>Opens the sheet, sees the new values, fills the rest by pasting from Excel, and asks the data-table builder for results by place and by group.</p></div>
          </div>
          <p className="sx-notice">The figures above are an example, not a real programme. Reports follow whichever donor template you bring.</p>
        </div>
      </section>

      <section>
        <div className="sx-wrap">
          <div className="sx-final">
            <h2>Start with the {page.name.toLowerCase()} dashboard.</h2>
            <p>Map your indicators to the template in minutes, then change anything.</p>
            <div className="sx-cta-row" style={{ justifyContent: "center", margin: 0 }}>
              <Link className="sx-btn sx-primary" href="/signup">Create a free workspace</Link>
              <Link className="sx-btn sx-ghost" href="/contact-sales">Book a walkthrough</Link>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
