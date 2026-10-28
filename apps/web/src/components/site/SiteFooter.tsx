import Link from "next/link";
import { SECTOR_PAGES } from "./site-data";

export function SiteFooter() {
  return (
    <footer>
      <div className="sx-wrap sx-fgrid">
        <div>
          <Link className="sx-logo" href="/" aria-label="DonorDesk home" style={{ padding: 0 }}>
            <i aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 18V9M10 18V5M16 18v-7M21 18H3" /></svg></i>
            DonorDesk
          </Link>
          <p style={{ marginTop: 10, maxWidth: "30ch" }}>Programme management for NGOs and the funders who back them.</p>
          <a href="https://www.linkedin.com/company/donordesk-online/" target="_blank" rel="noopener noreferrer" style={{ marginTop: 8 }}>LinkedIn</a>
        </div>
        <div>
          <h4>Product</h4>
          <Link href="/platform">Platform</Link>
          <Link href="/features">All features</Link>
          <Link href="/tour">Product tour</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/compare">Compare</Link>
          <Link href="/security">Security</Link>
        </div>
        <div>
          <h4>Solutions</h4>
          {SECTOR_PAGES.map((s) => <Link key={s.slug} href={`/solutions/${s.slug}`}>{s.name}</Link>)}
        </div>
        <div>
          <h4>Company</h4>
          <Link href="/support">Support centre</Link>
          <Link href="/contact-sales">Talk to us</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/refunds">Refunds</Link>
          <Link href="/subprocessors">Subprocessors</Link>
        </div>
      </div>
    </footer>
  );
}
