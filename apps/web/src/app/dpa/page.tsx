import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";
import { Section, A } from "@/components/legal/LegalBits";
import { LEGAL } from "@/lib/legal-entity";

export const metadata: Metadata = {
  alternates: { canonical: "/dpa" },
  title: "Data Processing Addendum",
  description: "The DonorDesk Data Processing Addendum for customers whose workspaces contain personal data.",
};

const TOC = [
  { id: "scope", title: "Scope and roles" },
  { id: "instructions", title: "Instructions" },
  { id: "confidentiality", title: "Confidentiality" },
  { id: "security", title: "Security" },
  { id: "subprocessors", title: "Sub-processors" },
  { id: "transfers", title: "International transfers" },
  { id: "drive", title: "Customer-provided storage" },
  { id: "rights", title: "Individuals' rights" },
  { id: "breach", title: "Personal data breach" },
  { id: "deletion", title: "Return and deletion" },
  { id: "audit", title: "Audits" },
  { id: "liability", title: "Liability and order of precedence" },
  { id: "details", title: "Processing details" },
];

export default function DpaPage() {
  return (
    <LegalLayout title="Data Processing Addendum" subtitle="Legal" updated={LEGAL.updated} toc={TOC}>
      <p className="mt-8 text-[15px] leading-7 text-slate-300">
        This Addendum (&ldquo;DPA&rdquo;) forms part of the <A href="/terms">Terms of Service</A> between{" "}
        {LEGAL.entityName} (&ldquo;DonorDesk&rdquo;, the processor) and the Customer (the controller) and applies
        when DonorDesk processes personal data in the Customer&apos;s workspace and data protection law (such as
        the GDPR or UK GDPR) applies. It applies automatically; a countersigned copy is available on request
        from <A href={`mailto:${LEGAL.legalEmail}`}>{LEGAL.legalEmail}</A>.
      </p>
      <Section id="scope" title="1. Scope and roles">
        <p>
          The Customer is the controller of personal data it puts in the Service (&ldquo;Customer Personal Data&rdquo;);
          DonorDesk is its processor. DonorDesk is an independent controller of account, billing and usage data,
          as described in the <A href="/privacy">Privacy Policy</A>. The Customer is responsible for having a legal
          basis, giving notices and obtaining consents for its data, and for the lawfulness of its instructions.
        </p>
      </Section>
      <Section id="instructions" title="2. Instructions">
        <p>
          DonorDesk processes Customer Personal Data only on the Customer&apos;s documented instructions: the Terms,
          this DPA, and the Customer&apos;s use and configuration of the Service. DonorDesk will tell the Customer if
          it believes an instruction infringes data protection law, but is not obliged to check the lawfulness of
          instructions. DonorDesk may process data where required by law, informing the Customer where permitted.
        </p>
      </Section>
      <Section id="confidentiality" title="3. Confidentiality">
        <p>DonorDesk ensures that personnel authorised to process Customer Personal Data are bound by confidentiality.</p>
      </Section>
      <Section id="security" title="4. Security">
        <p>
          DonorDesk applies appropriate technical and organisational measures, including: encryption in transit;
          tenant isolation enforced in the database (row-level security); role-based access with least privilege;
          an immutable audit log; access controls and monitoring; and backups. See{" "}
          <A href="/security">Security &amp; trust</A>. The Customer is responsible for its own user access, credentials,
          roles and configuration, and for assessing that these measures suit its data. DonorDesk may update
          measures if the overall level of protection is not reduced.
        </p>
      </Section>
      <Section id="subprocessors" title="5. Sub-processors">
        <p>
          The Customer gives general authorisation to the sub-processors listed on{" "}
          <A href="/subprocessors">/subprocessors</A>. DonorDesk binds them to data protection obligations no less
          protective than this DPA and remains responsible for their performance. Changes and objections are handled
          as described on that page.
        </p>
      </Section>
      <Section id="transfers" title="6. International transfers">
        <p>
          Customer Personal Data may be processed outside the Customer&apos;s country. Where required, the parties
          rely on an adequacy decision or the Standard Contractual Clauses (Module 2, controller to processor, and
          Module 3 where applicable), and the UK Addendum for UK transfers, which are incorporated by reference and
          completed with the details in section 12 and the sub-processor list. The Customer, not DonorDesk, is
          responsible for any additional donor or local-law restrictions on data location.
        </p>
      </Section>
      <Section id="drive" title="6A. Customer-provided storage (Google Drive)">
        <p>
          Where the Customer connects its own Google Drive (or another storage account), that account is the Customer&apos;s
          own service and the Customer is responsible for its security, sharing settings, retention, and its agreement
          with the provider; the provider is not a DonorDesk sub-processor for files stored there. DonorDesk accesses it
          only within the permissions the Customer grants (limited file access, file and folder names, and read-only spreadsheet access, as described in our Support Center) and may keep references, extracted text, and derived records
          in its own systems as described in section 12. If the Customer revokes access or deletes files in its account,
          related features may stop working and DonorDesk is not responsible for data the Customer holds in that account.
        </p>
      </Section>
      <Section id="rights" title="7. Individuals' rights">
        <p>
          DonorDesk will, taking into account the nature of processing, give the Customer reasonable assistance
          through the Service&apos;s features (export, edit, delete) to respond to individuals&apos; requests. Requests
          received directly by DonorDesk will be forwarded to the Customer. Assistance beyond the Service&apos;s
          standard features may be charged at reasonable cost.
        </p>
      </Section>
      <Section id="breach" title="8. Personal data breach">
        <p>
          DonorDesk will notify the Customer without undue delay (and aim for within 72 hours) after becoming aware
          of a personal data breach affecting Customer Personal Data, with the information then available, and take
          reasonable steps to contain it. Notification is not an admission of fault. The Customer is responsible for
          notifying regulators, donors and individuals.
        </p>
      </Section>
      <Section id="deletion" title="9. Return and deletion">
        <p>
          On termination the Customer may export its data for the transition period in the Terms. After that,
          DonorDesk deletes Customer Personal Data, except where law requires retention; copies in backups are
          deleted in the normal backup cycle.
        </p>
      </Section>
      <Section id="audit" title="10. Audits">
        <p>
          DonorDesk will provide information reasonably needed to show compliance with this DPA. Where that is not
          sufficient, the Customer may, on 30 days&apos; notice, no more than once a year, and under confidentiality,
          audit DonorDesk&apos;s relevant controls at the Customer&apos;s cost, in a way that does not disrupt DonorDesk or
          expose other customers&apos; data. Regulator audits are permitted as required by law.
        </p>
      </Section>
      <Section id="liability" title="11. Liability and order of precedence">
        <p>
          Each party&apos;s liability under this DPA is subject to the limits and exclusions in the Terms, to the extent
          the law allows. If this DPA conflicts with the Terms on data protection, this DPA prevails; if it conflicts
          with the Standard Contractual Clauses, the Clauses prevail.
        </p>
      </Section>
      <Section id="details" title="12. Processing details">
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>Subject matter and purpose:</strong> providing the DonorDesk reporting, evidence-management and AI-assisted drafting service.</li>
          <li><strong>Duration:</strong> the term of the Customer&apos;s subscription plus the transition period.</li>
          <li><strong>Data subjects:</strong> the Customer&apos;s staff and partners, beneficiaries, and other individuals named in its records.</li>
          <li><strong>Data types:</strong> contact details, activity and evidence records, report content, and any special-category data the Customer chooses to upload.</li>
          <li><strong>Hosting:</strong> {LEGAL.hostingLocation}. Source files may instead sit in the Customer&apos;s own Google Drive (section 6A).</li>
          <li><strong>Contact for data protection:</strong> <A href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</A>.</li>
        </ul>
      </Section>
    </LegalLayout>
  );
}
