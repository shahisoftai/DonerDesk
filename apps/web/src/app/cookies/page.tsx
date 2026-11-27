import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LegalLayout } from "@/components/legal/LegalLayout";
import { LEGAL } from "@/lib/legal-entity";

export const metadata: Metadata = {
  alternates: { canonical: "/cookies" },
  title: "Cookie Policy",
  description:
    "How DonorDesk uses cookies and similar browser storage to run, secure, and personalize the donordesk.online service.",
};

const TOC = [
  { id: "what", title: "What are cookies" },
  { id: "use", title: "What we use" },
  { id: "not", title: "What we do not use" },
  { id: "control", title: "Your choices" },
  { id: "third-parties", title: "Third parties" },
  { id: "changes", title: "Changes and contact" },
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-12 scroll-mt-24">
      <h2 className="text-2xl font-bold text-white">{title}</h2>
      <div className="mt-4 space-y-4 text-[15px] leading-7 text-slate-300">{children}</div>
    </section>
  );
}

export default function CookiesPage() {
  return (
    <LegalLayout title="Cookie Policy" subtitle="Legal" updated={LEGAL.analyticsPoliciesUpdated} toc={TOC}>
      <Section id="what" title="1. What are cookies">
        <p>
          Cookies are small text files stored by your browser. We also use similar browser storage
          (such as local storage). This policy supplements our{" "}
          <a className="font-medium text-brand-300 underline" href="/privacy">Privacy Policy</a>.
        </p>
      </Section>
      <Section id="use" title="2. What we use">
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>Essential</strong> — sign-in session and security tokens, needed for the Service to work. These cannot be switched off.</li>
          <li><strong>Preferences</strong> — your theme (light/dark), language, and small interface reminders you have dismissed. Stored in your browser only.</li>
          <li><strong>Choices you make</strong> — a cookie (<code>dd_cookie_consent</code>) that records your answer to the cookie question, kept for six months so we do not ask again.</li>
          <li>
            <strong>Analytics (only if you accept)</strong> — on our public pages (home, features, pricing, tour, security, support, sign-up and the legal pages)
            we use Google Analytics 4, which sets the cookies <code>_ga</code> and <code>_ga_*</code> for up to 14 months. They count visits and show which pages
            and countries they come from, with no advertising features and with Google signals switched off. We never use analytics inside the
            signed-in app or on share, embed, form, invitation and password-reset pages. Nothing is sent to Google unless you accept.
          </li>
        </ul>
      </Section>
      <Section id="not" title="3. What we do not use">
        <p>
          We do not use advertising cookies or cross-site tracking, and we do not sell or share
          cookie data for advertising. Analytics cookies are used only if you accept them, as described above.
        </p>
      </Section>
      <Section id="control" title="4. Your choices">
        <p>
          You can change your answer at any time with &ldquo;Cookie settings&rdquo; in the footer of our public pages. Declining stops
          analytics at once and removes the analytics cookies from your browser. You can also block or delete cookies in your browser
          settings. Blocking essential cookies will prevent you from signing in or using the Service. Clearing browser storage resets
          your preferences.
        </p>
      </Section>
      <Section id="third-parties" title="5. Third parties">
        <p>
          If you accept analytics, Google LLC receives the usage data these cookies collect (pages visited, approximate location from
          your network address, device and browser type) and processes it for us as described in our{" "}
          <a className="font-medium text-brand-300 underline" href="/subprocessors#website">sub-processor list</a>. If you use a
          third-party service connected to the Service (for example the payment page of our payment partner, or Google Drive), that
          service may set its own cookies under its own policy. We do not control them.
        </p>
      </Section>
      <Section id="changes" title="6. Changes and contact">
        <p>
          We may update this policy and will change the effective date above. Questions:{" "}
          <a className="font-medium text-brand-300 underline" href="mailto:legal@donordesk.online">legal@donordesk.online</a>.
        </p>
      </Section>
    </LegalLayout>
  );
}
