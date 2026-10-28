import type { Metadata } from "next";
import Link from "next/link";
import { ContactSalesForm } from "./ContactSalesForm";
import { CookieConsentBanner } from "@/components/legal/CookieConsentBanner";
import { SiteShell } from "@/components/site/SiteShell";
import { SiteFooter } from "@/components/site/SiteFooter";

export const metadata: Metadata = {
  alternates: { canonical: "/contact-sales" },
  title: "Talk to Sales",
  description: "Tell us about your organization and reporting needs — DonorDesk's Enterprise team will follow up.",
};

export default function ContactSalesPage() {
  return (
    <SiteShell footer={<SiteFooter />}>
    <div className="sx-wrap sx-prose" style={{ maxWidth: 640 }}>
      <h1>Talk to sales</h1>
      <p className="sx-lede" style={{ marginTop: 10 }}>
        Tell us about your organization and reporting needs. Our Enterprise team will follow up by email.
      </p>
      <div className="card mt-6">
        <ContactSalesForm />
      </div>
      <p className="sx-fine" style={{ marginTop: 16 }}>
        Prefer email?{" "}
        <a className="sx-link" href="mailto:support@donordesk.online">
          support@donordesk.online
        </a>
      </p>
      <p className="sx-fine" style={{ marginTop: 24 }}>
        <Link className="sx-link" href="/pricing">
          Back to pricing
        </Link>
      </p>
    </div>
      <CookieConsentBanner />
    </SiteShell>
  );
}
