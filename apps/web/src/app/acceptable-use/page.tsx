import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";
import { Section, A } from "@/components/legal/LegalBits";
import { LEGAL } from "@/lib/legal-entity";

export const metadata: Metadata = {
  alternates: { canonical: "/acceptable-use" },
  title: "Acceptable Use Policy",
  description: "What you may and may not do with DonorDesk.",
};

const TOC = [
  { id: "rules", title: "Prohibited use" },
  { id: "data", title: "Sensitive data" },
  { id: "ai", title: "AI features" },
  { id: "enforcement", title: "Enforcement" },
];

export default function AcceptableUsePage() {
  return (
    <LegalLayout title="Acceptable Use Policy" subtitle="Legal" updated={LEGAL.updated} toc={TOC}>
      <p className="mt-8 text-[15px] leading-7 text-slate-300">
        This policy is part of the <A href="/terms">Terms of Service</A>. You are responsible for everyone who uses your workspace.
      </p>
      <Section id="rules" title="1. Prohibited use">
        <ul className="list-disc space-y-2 pl-6">
          <li>Anything unlawful, fraudulent or misleading, including fabricating evidence, indicator values or reports submitted to donors.</li>
          <li>Uploading content that is malicious, infringing, defamatory, hateful, or that sexually exploits or abuses children (reported to authorities).</li>
          <li>Probing, scanning, overloading or bypassing the security, limits or tenant isolation of the Service, or accessing another workspace.</li>
          <li>Reselling or sharing accounts, scraping, or building a competing product from the Service.</li>
          <li>Use that breaches sanctions, export-control, counter-terrorism or anti-money-laundering law, or that supports violence or persecution of people.</li>
        </ul>
      </Section>
      <Section id="data" title="2. Sensitive data">
        <p>
          Upload personal data only if you have a lawful basis and any required consent, and collect no more than you need. Do not
          upload data that identifies at-risk people unless it is necessary and you have protected it appropriately. Do not upload
          payment card numbers, government ID numbers or passwords unless the feature asks for them.
        </p>
      </Section>
      <Section id="ai" title="3. AI features">
        <p>
          Review all AI output before use. Do not use AI features to generate deceptive content, to make decisions with legal
          effect on individuals, or to bypass your donor&apos;s rules on AI use.
        </p>
      </Section>
      <Section id="enforcement" title="4. Enforcement">
        <p>
          We may remove content, suspend or end access, and report unlawful activity to authorities, with or without notice where
          needed to protect the Service or people. Report abuse or vulnerabilities to{" "}
          <A href={`mailto:${LEGAL.legalEmail}`}>{LEGAL.legalEmail}</A>.
        </p>
      </Section>
    </LegalLayout>
  );
}
