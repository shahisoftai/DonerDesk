import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LegalLayout } from "@/components/legal/LegalLayout";

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
    <LegalLayout title="Cookie Policy" subtitle="Legal" updated="7 October 2026 (Version 1.0)" toc={TOC}>
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
          <li><strong>Choices you make</strong> — for example a short-lived cookie recording a banner choice you made, so we do not ask again.</li>
        </ul>
      </Section>
      <Section id="not" title="3. What we do not use">
        <p>
          We do not use advertising cookies or cross-site tracking, and we do not sell or share
          cookie data for advertising. If we add analytics in the future, we will update this
          policy and, where the law requires, ask for your consent first.
        </p>
      </Section>
      <Section id="control" title="4. Your choices">
        <p>
          You can block or delete cookies in your browser settings. Blocking essential cookies will
          prevent you from signing in or using the Service. Clearing browser storage resets your
          preferences.
        </p>
      </Section>
      <Section id="third-parties" title="5. Third parties">
        <p>
          If you use a third-party service connected to the Service (for example the payment page
          of our payment partner, or Google Drive), that service may set its own cookies under its
          own policy. We do not control them.
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
