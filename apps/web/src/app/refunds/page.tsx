import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LegalLayout } from "@/components/legal/LegalLayout";
import { Section, A, Table } from "@/components/legal/LegalBits";
import { LEGAL } from "@/lib/legal-entity";

export const metadata: Metadata = {
  alternates: { canonical: "/refunds" },
  title: "Refund & Cancellation Policy",
  description:
    "How to cancel a DonorDesk subscription, when a payment is refunded, how to ask for a refund, and what happens to your data and AI credits.",
};

const TOC = [
  { id: "scope", title: "Scope" },
  { id: "cancel", title: "Cancelling a plan" },
  { id: "refunds", title: "When we refund" },
  { id: "request", title: "How to request a refund" },
  { id: "data", title: "Refunds and your data" },
  { id: "interruption", title: "Service interruptions" },
  { id: "disputes", title: "Disputes and chargebacks" },
  { id: "taxes", title: "Taxes and receipts" },
  { id: "rights", title: "Your legal rights" },
  { id: "changes", title: "Changes to this policy" },
  { id: "contact", title: "Contact" },
];

export default function RefundsPage() {
  return (
    <LegalLayout
      title="Refund & Cancellation Policy"
      subtitle="Legal"
      updated={LEGAL.refundPolicyUpdated}
      toc={TOC}
    >
      <Section id="scope" title="1. Scope">
        <P>
          This policy explains how you cancel a DonorDesk subscription, when a payment is
          refunded, and how to ask us for one. It applies to every paid plan you buy on
          donordesk.online, including AI credit packs. It forms part of our{" "}
          <A href="/terms">Terms of Service</A>: where the two differ, the Terms apply to
          everything except refunds, and this policy applies to refunds.
        </P>
        <P>
          Enterprise and other contracted arrangements are different. Where you have a signed
          order form or a written contract with us, its refund and cancellation terms apply
          instead of this policy, and we will show you those terms before you sign.
        </P>
        <P>
          Payments are taken by our payment partner <B>Creem</B>, which acts as merchant of
          record: Creem takes the payment, calculates and remits sales tax or VAT, and issues
          your invoice and receipt. Creem's own terms also apply to the transaction. We are
          responsible to you for the refund, and we ask Creem to carry it out for us.
        </P>
      </Section>

      <Section id="cancel" title="2. Cancelling a plan">
        <P>
          The free Starter plan costs nothing, so there is nothing to cancel or refund on it.
          The paid Team and Growth plans are sold monthly or annually and renew automatically
          for the same period until you cancel.
        </P>
        <P>
          You cancel from your own workspace, without calling us: open{" "}
          <B>Settings → Billing</B> and choose <B>Manage subscription</B>, which opens the
          billing portal where you cancel the subscription. Cancelling a plan is not harder
          than taking one, and you do not need to explain why.
        </P>
        <Ul>
          <Li>
            <B>Cancellation takes effect at the end of the period you have already paid for.</B>{" "}
            You keep every paid feature until then. We do not give a refund for the unused
            part of a period you chose to leave, unless section 3 says we do.
          </Li>
          <Li>
            <B>Your data is never deleted.</B> When the paid period ends, your workspace
            returns to the free Starter limits. You keep read, export and delete access, and
            anything over the Starter limits becomes read-only until you upgrade or reduce
            what you use. You can upgrade again at any time.
          </Li>
          <Li>
            <B>A failed payment does not end your work.</B> If a renewal payment fails, we
            keep your paid features during a short grace period while the payment is
            retried, and we email you. Update your card in the billing portal to avoid a
            downgrade. If the grace period ends without a successful payment, the workspace
            returns to the Starter limits as described above.
          </Li>
          <Li>
            <B>Downgrading a plan</B> works the same way: the lower plan starts at the end
            of the paid period, and you keep the features you have paid for until then.
          </Li>
          <Li>
            <B>An annual plan</B> stays active until the end of the year you paid for. We do
            not normally refund the unused months. We do consider a request, in particular if
            we changed the price of the plan or materially changed the service after you
            bought it.
          </Li>
        </Ul>
      </Section>

      <Section id="refunds" title="3. When we refund">
        <P>
          Paid fees are not refundable in general. They are refundable in the situations
          below, and we decide each request in good faith, on the facts you give us and on
          our own records.
        </P>
        <Table
          head={["What happened", "What we do"]}
          rows={[
            [
              "You were charged twice for the same payment.",
              "We refund the duplicate amount in full.",
            ],
            [
              "You were charged after you cancelled.",
              "We refund the renewal in full, and make sure the subscription stays cancelled.",
            ],
            [
              "The amount charged is not the amount shown at checkout.",
              "We refund the difference.",
            ],
            [
              "We charged the wrong plan or the wrong billing interval.",
              "We refund the difference and set the plan and interval you asked for.",
            ],
            [
              "You subscribed by mistake and have not used the paid features.",
              "We refund in full if you ask within 14 days of the charge.",
            ],
            [
              "You bought an AI credit pack and have not used any of it.",
              "We refund the pack in full if you ask within 30 days of the purchase.",
            ],
            [
              "You bought an AI credit pack and used part of it.",
              "We do not refund the credits you already used. We consider a refund of the unused balance.",
            ],
            [
              "The paid service was materially unavailable for more than 72 consecutive hours and it was our fault.",
              "We credit the affected time — see section 6.",
            ],
            [
              "You closed your organisation and no longer need the service.",
              "Tell us before you cancel. We look at the circumstances and consider a refund or a credit, but we cannot promise one.",
            ],
          ]}
        />
        <P>
          Please tell us about a billing error within 30 days of the charge, and give us the
          details in section 4. Reporting a problem early is what lets us correct the
          records. This 30-day window does not affect any right you have under the law of
          your country, and it does not apply to the situations in section 6.
        </P>
      </Section>

      <Section id="request" title="4. How to request a refund">
        <P>
          Refunds are handled case by case by a person. To ask for one:
        </P>
        <Ul>
          <Li>
            Email <A href={`mailto:${LEGAL.billingEmail}`}>{LEGAL.billingEmail}</A> from the
            email address registered on the workspace, or ask the workspace administrator to
            write to us.
          </Li>
          <Li>
            Give us the email address on the account, the receipt or invoice number, the date
            and the amount charged, and the reason for the request. A request without the
            receipt number is the one we cannot act on fastest.
          </Li>
          <Li>
            We acknowledge every request within 5 business days and send you our decision
            within 15 business days. If we need more time, we tell you why and when we will
            come back to you.
          </Li>
          <Li>
            If we agree, Creem refunds the original payment method. Most banks post the
            credit within 5 to 10 business days of it being sent. We cannot make a bank
            release it faster, but we will confirm to you when it has been sent.
          </Li>
          <Li>
            If we turn the request down, we tell you why and you can take it further through
            section 9.
          </Li>
        </Ul>
      </Section>

      <Section id="data" title="5. Refunds and your data">
        <P>
          A refund never deletes your data, and it never takes work you have already done
          away from you:
        </P>
        <Ul>
          <Li>
            <B>Your workspace and files stay.</B> A refunded subscription ends the paid
            features and returns you to the Starter limits, exactly as if you had cancelled.
            Reading, exporting and deleting still work.
          </Li>
          <Li>
            <B>AI credits you already used are not taken back.</B> A refunded top-up pack
            stops drawing down, but the report drafts it already paid for stay done.
          </Li>
          <Li>
            <B>A refunded pack is not replaced.</B> Refunded credits are not returned to your
            balance; buying again is a new purchase.
          </Li>
          <Li>
            <B>A Growth prepaid standing balance</B> stops drawing down if you downgrade or
            cancel. If you subscribe to Growth again, it starts drawing down again with the
            credits it had left. A regular top-up pack is not affected by a downgrade: it
            keeps drawing down against whatever plan you are on.
          </Li>
        </Ul>
      </Section>

      <Section id="interruption" title="6. Service interruptions">
        <P>
          If the paid service is materially unavailable — you cannot sign in, or the paid
          features do not work — for more than 72 consecutive hours, and the cause was
          ours, we review the report and normally credit the affected time. The credit is
          applied to your next invoice, or paid back to you if you have already cancelled.
        </P>
        <P>To use this, tell us within 30 days of the interruption:</P>
        <Ul>
          <Li>
            Email <A href={`mailto:${LEGAL.billingEmail}`}>{LEGAL.billingEmail}</A> with the
            dates and times you could not use the service and what you saw.
          </Li>
          <Li>
            We look at the request against our own service records and tell you our decision
            and the amount of the credit.
          </Li>
        </Ul>
        <P>
          Maintenance we announced in advance, events outside our reasonable control, and
          problems with services you connect yourself — such as Google Drive or an AI
          provider you configured for your workspace — are not covered. This section does not
          limit any other right you have, including the rights in section 9.
        </P>
      </Section>

      <Section id="disputes" title="7. Disputes and chargebacks">
        <P>
          If you disagree with a charge, please tell us first. A chargeback with your bank
          usually reverses the payment, but the reversal also costs us the fee, and it leaves
          us unable to fix the record. We will still help with a charge you have already
          disputed.
        </P>
        <P>
          A chargeback is not a way to keep using the service. While a dispute is open we may
          suspend the paid features of the workspace until it is settled. We do not charge you
          a fee for handling a dispute we agree with, and we do not set a refund off against
          a later invoice unless you ask us to.
        </P>
      </Section>

      <Section id="taxes" title="8. Taxes and receipts">
        <P>
          Creem acts as merchant of record, so it calculates and remits sales tax or VAT and
          issues the invoice or receipt for every payment. A refund goes back through the
          same partner, so the tax on it is adjusted to match the amount we return. You
          receive a receipt for every payment: Creem emails it to the billing address, and
          the billing portal lists the full payment history.
        </P>
        <P>
          If your organisation is tax exempt, or you need a VAT number on the invoice, write
          to <A href={`mailto:${LEGAL.billingEmail}`}>{LEGAL.billingEmail}</A> before your
          next renewal.
        </P>
      </Section>

      <Section id="rights" title="9. Your legal rights">
        <P>
          Some countries give consumers statutory rights, including a cooling-off period
          after a distance contract and the right to a refund where a service is not as
          described. Where those rights apply, they take precedence over this policy.
          Nothing in this policy or in our Terms limits a right that cannot be waived by
          law.
        </P>
        <P>
          DonorDesk is built for organisations and professionals, and this policy is written
          on that basis. If you are a consumer, ask us before you buy and we will confirm
          what you are entitled to.
        </P>
        <P>
          If you are unhappy with how we handled a refund request, write to us first and we
          will review it, including by a manager. You also have the right to complain to the
          consumer protection authority or ombudsman in your country. The law that governs
          this policy, and the forum that applies, are set out in section 20 of the{" "}
          <A href="/terms">Terms of Service</A>.
        </P>
      </Section>

      <Section id="changes" title="10. Changes to this policy">
        <P>
          We may change this policy. If a change affects a plan you have already bought, we
          will tell you by email before it takes effect, and the version that applied when
          you paid is the version we will apply to a refund request for that payment.
        </P>
      </Section>

      <Section id="contact" title="11. Contact">
        <P>
          Refund requests:{" "}
          <A href={`mailto:${LEGAL.billingEmail}`}>{LEGAL.billingEmail}</A>. Questions about
          this policy: <A href={`mailto:${LEGAL.legalEmail}`}>{LEGAL.legalEmail}</A>. See also
          the <A href="/terms">Terms of Service</A> (section 9, fees and payment) and{" "}
          <A href="/pricing">our pricing</A>.
        </P>
        <div className="rounded-xl border border-brand-400/20 bg-brand-500/5 p-5">
          <p className="font-semibold text-white">DonorDesk.Online — Legal</p>
          <p className="mt-1 text-slate-300">
            Email:{" "}
            <A href={`mailto:${LEGAL.legalEmail}`}>{LEGAL.legalEmail}</A>
          </p>
          <p className="mt-1 text-slate-300">
            Service: <span className="text-brand-300">https://donordesk.online</span>
          </p>
        </div>
      </Section>
    </LegalLayout>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p>{children}</p>;
}

function B({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-slate-100">{children}</strong>;
}

function Ul({ children }: { children: ReactNode }) {
  return <ul className="space-y-2.5 pl-5 marker:text-brand-400 marker:font-bold">{children}</ul>;
}

function Li({ children }: { children: ReactNode }) {
  return <li className="list-disc">{children}</li>;
}
