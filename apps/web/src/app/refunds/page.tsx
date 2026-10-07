import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";
import { Section, A } from "@/components/legal/LegalBits";
import { LEGAL } from "@/lib/legal-entity";

export const metadata: Metadata = {
  alternates: { canonical: "/refunds" },
  title: "Refund & Cancellation Policy",
  description: "How cancellation, renewal and refunds work for DonorDesk subscriptions.",
};

const TOC = [
  { id: "cancel", title: "Cancellation" },
  { id: "refunds", title: "Refunds" },
  { id: "law", title: "Your legal rights" },
  { id: "contact", title: "Contact" },
];

export default function RefundsPage() {
  return (
    <LegalLayout title="Refund & Cancellation Policy" subtitle="Legal" updated={LEGAL.updated} toc={TOC}>
      <Section id="cancel" title="1. Cancellation">
        <p>
          Paid subscriptions renew automatically. Cancel any time from your billing settings before the renewal date;
          you keep access until the end of the paid period, then your workspace moves to the free tier where you can still
          read, export and delete your data. Cancelling does not delete data.
        </p>
      </Section>
      <Section id="refunds" title="2. Refunds">
        <p>
          Fees are non-refundable, including for unused time, downgrades and unused top-ups, except where the law requires
          otherwise or we agree in writing. If we charged you in error or charged twice, tell us within 30 days and we will
          correct it. Payments are processed by our payment partner as merchant of record; refunds, where granted, are paid
          back to the original payment method.
        </p>
      </Section>
      <Section id="law" title="3. Your legal rights">
        <p>
          Some countries give consumers statutory cancellation or refund rights. DonorDesk is intended for organisations
          and professionals, and nothing here limits rights that cannot be waived by law.
        </p>
      </Section>
      <Section id="contact" title="4. Contact">
        <p>
          Billing questions: <A href={`mailto:${LEGAL.legalEmail}`}>{LEGAL.legalEmail}</A>. See also the{" "}
          <A href="/terms">Terms of Service</A> (section 9, Fees and payment).
        </p>
      </Section>
    </LegalLayout>
  );
}
