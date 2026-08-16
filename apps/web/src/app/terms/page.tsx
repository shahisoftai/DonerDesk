import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The DonorDesk Terms of Service govern the use of the donordesk.online platform by organizations and their teams, including acceptable use, content ownership, AI-assisted features, liability, and dispute resolution.",
};

const TOC = [
  { id: "agreement", title: "Agreement and scope" },
  { id: "eligibility", title: "Eligibility" },
  { id: "accounts", title: "Accounts and security" },
  { id: "license", title: "License to use the Service" },
  { id: "your-content", title: "Your content and data" },
  { id: "acceptable-use", title: "Acceptable use" },
  { id: "ai-features", title: "AI-assisted features" },
  { id: "compliance", title: "Compliance and data protection" },
  { id: "fees", title: "Fees and payment" },
  { id: "intellectual-property", title: "Intellectual property" },
  { id: "confidentiality", title: "Confidentiality" },
  { id: "third-party", title: "Third-party services" },
  { id: "availability", title: "Availability and disclaimers" },
  { id: "liability", title: "Limitation of liability" },
  { id: "indemnification", title: "Indemnification" },
  { id: "termination", title: "Termination and suspension" },
  { id: "copyright", title: "Copyright and takedown notices" },
  { id: "beta", title: "Beta and evaluation services" },
  { id: "changes", title: "Changes to these Terms" },
  { id: "governing-law", title: "Governing law and disputes" },
  { id: "general", title: "General provisions" },
  { id: "contact", title: "Contact us" },
];

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      subtitle="Legal"
      updated="14 August 2026 (Version 1.0)"
      toc={TOC}
    >
      <Section id="agreement" title="1. Agreement and scope">
        <P>
          These Terms of Service (“<B>Terms</B>”) are a legally binding agreement
          between DonorDesk.Online (“<B>DonorDesk</B>”, “<B>we</B>”, “<B>us</B>”,
          or “<B>our</B>”) and the organization, entity, or individual that
          creates a workspace on the Service (“<B>you</B>”, “<B>your</B>”, or “
          <B>Customer</B>”). They govern your access to and use of the DonorDesk
          platform and related services available at{" "}
          <B>https://donordesk.online</B> (the “<B>Service</B>”).
        </P>
        <P>
          By creating an account, accessing the Service, or clicking to accept
          these Terms, you agree to be bound by these Terms and by our{" "}
          <A href="/privacy">Privacy Policy</A>, which is incorporated by
          reference. If you are entering into these Terms on behalf of an
          organization, you represent that you have authority to bind that
          organization, and references to “you” mean that organization and the
          individuals authorized to use the Service on its behalf.
        </P>
        <P>
          Acceptance during onboarding. As the final step of workspace setup, you
          will be asked to confirm your acceptance of the then-current version of
          these Terms and the Privacy Policy by checking a consent box and
          submitting it. Your submission is recorded in the Service's immutable
          audit trail (including your identity, the document versions you
          accepted, the date and time, and the IP address used) and constitutes
          your binding acceptance of those versions. If you do not accept, you
          will not be able to complete onboarding and use the Service.
        </P>
        <P>
          If you do not agree to these Terms, do not use the Service.
        </P>
      </Section>

      <Section id="eligibility" title="2. Eligibility">
        <P>
          You must be at least 18 years old (or the age of majority in your
          jurisdiction) to use the Service. By using the Service, you confirm that
          you meet this requirement and that you are not located in a country
          subject to an embargo that prohibits the provision of the Service, and
          that you are not on any sanctions list that would make your use of the
          Service unlawful.
        </P>
        <P>
          The Service is intended for use by non-governmental organizations,
          humanitarian programmes, and their professional teams. You are
          responsible for ensuring that your use of the Service complies with all
          laws applicable to your organization.
        </P>
      </Section>

      <Section id="accounts" title="3. Accounts and security">
        <P>
          You are responsible for safeguarding your account credentials and for
          all activity that occurs under your account. You must keep your
          passwords confidential and notify us promptly at{" "}
          <A href="mailto:legal@donordesk.online">legal@donordesk.online</A>{" "}
          if you suspect unauthorized access to your account.
        </P>
        <P>
          When you create a workspace, you will designate users and assign
          permissions. You are responsible for the actions of your users and for
          ensuring that access is granted only to individuals who should have it.
          We are not liable for losses caused by your failure to protect your
          credentials or your workspace configuration.
        </P>
        <P>
          You must provide accurate information when creating an account and keep
          it current. We may verify the identity of workspace administrators as
          part of onboarding and ongoing compliance.
        </P>
      </Section>

      <Section id="license" title="4. License to use the Service">
        <P>
          Subject to your compliance with these Terms, we grant you a
          non-exclusive, non-transferable, revocable right to access and use the
          Service for your internal business operations related to donor
          reporting, evidence management, and compliance, in accordance with your
          subscription plan and any applicable agreements.
        </P>
        <P>
          You may not, and may not permit others to: reverse engineer, decompile,
          or attempt to derive the source code of the Service; copy, frame, or
          mirror the Service; resell, sublicense, or otherwise commercialize the
          Service except as expressly permitted; or access the Service to build a
          competing product.
        </P>
      </Section>

      <Section id="your-content" title="5. Your content and data">
        <P>
          As between you and us, you retain all rights, title, and interest in
          and to the content, data, documents, evidence files, reports, and other
          materials you upload to or create in the Service (“<B>Your Data</B>”).
          You grant us a limited, non-exclusive license to host, process, and
          display Your Data solely to operate, maintain, and improve the Service
          for you, and to comply with legal obligations.
        </P>
        <P>
          You represent and warrant that you have all necessary rights and
          permissions to provide Your Data to the Service, including any
          consents required to process personal information of beneficiaries,
          staff, or partners, and that Your Data does not violate the rights of
          any third party.
        </P>
        <P>
          Your Data is yours. We do not claim ownership of Your Data, and we will
          not use Your Data for purposes other than providing and maintaining the
          Service, except with your consent or as required by law.
        </P>
      </Section>

      <Section id="acceptable-use" title="6. Acceptable use">
        <P>You agree not to use the Service to:</P>
        <Ul>
          <Li>
            Engage in any unlawful, harmful, or fraudulent activity, or in any
            activity that violates the rights of others.
          </Li>
          <Li>
            Transmit content that is defamatory, obscene, harassing, hateful, or
            that promotes violence or discrimination.
          </Li>
          <Li>
            Attempt to access, probe, or interfere with the Service, other users'
            workspaces, or the infrastructure that supports the Service.
          </Li>
          <Li>
            Upload files containing malicious code, or use the Service to
            distribute malware, phishing, or spam.
          </Li>
          <Li>
            Circumvent, disable, or interfere with security features, rate limits,
            or usage restrictions of the Service.
          </Li>
          <Li>
            Use the Service in violation of any applicable export-control,
            sanctions, or anti-money-laundering laws.
          </Li>
          <Li>
            Upload, store, or distribute content involving the sexual exploitation
            or abuse of children, or use the Service in any way connected with
            child exploitation. Any such content will be reported to the relevant
            authorities.
          </Li>
        </Ul>
        <P>
          We may suspend or terminate access to the Service for users or
          workspaces that violate this section.
        </P>
      </Section>

      <Section id="ai-features" title="7. AI-assisted features">
        <P>
          The Service includes AI-assisted drafting features that generate
          source-linked narrative from Your Data. By using these features, you
          acknowledge and agree that:
        </P>
        <Ul>
          <Li>
            AI-generated content is assistive, not authoritative. You are
            responsible for reviewing, verifying, editing, and approving all
            AI-generated output before use or distribution.
          </Li>
          <Li>
            AI models can produce inaccurate, incomplete, or unexpected results.
            We make no warranty that AI-generated content is accurate, complete,
            or suitable for your purposes.
          </Li>
          <Li>
            Every AI output is recorded with the model, prompt version, and source
            references used, and remains subject to your team's review and
            approval workflow.
          </Li>
          <Li>
            Where AI features require transmission of Your Data to a third-party
            AI provider, we will use the provider only to generate the content
            you request. If your donor requirements demand that data not be
            processed by third-party AI providers, contact us to discuss
            configuration options.
          </Li>
        </Ul>
      </Section>

      <Section id="compliance" title="8. Compliance and data protection">
        <P>
          Each party will comply with the data protection and privacy laws
          applicable to it. We process personal information in accordance with our{" "}
          <A href="/privacy">Privacy Policy</A>. Where required by applicable law,
          you may enter into our data processing addendum, which is available on
          request from{" "}
          <A href="mailto:legal@donordesk.online">legal@donordesk.online</A>.
        </P>
        <P>
          You are responsible for the lawfulness of Your Data and for obtaining
          all consents, authorizations, and approvals required to process personal
          information through the Service. You will implement appropriate
          safeguards for any sensitive or special-category data, including data
          about children or beneficiaries, and will use the Service in a manner
          consistent with humanitarian principles and applicable child-protection
          and data-protection obligations.
        </P>
        <P>
          Neither party is liable for losses arising from the other party's
          failure to comply with applicable data protection law.
        </P>
      </Section>

      <Section id="fees" title="9. Fees and payment">
        <P>
          The Service may be offered free of charge during an initial or demo
          period. Where we offer paid plans, fees will be described on our
          pricing materials or in a separate order form, and payment terms will
          be as stated there. Fees are non-refundable except as required by law
          or as expressly stated in an order form.
        </P>
        <P>
          We may change fees or introduce fees for features by giving you
          reasonable advance notice. If you do not agree to a fee change, you may
          stop using the Service before the change takes effect. Continued use of
          the Service after the change takes effect constitutes acceptance.
        </P>
      </Section>

      <Section id="intellectual-property" title="10. Intellectual property">
        <P>
          As between you and us, DonorDesk and its licensors own all rights,
          title, and interest in and to the Service, including its software,
          design, documentation, branding, algorithms, and any content we make
          available that is not Your Data. You may not remove, alter, or obscure
          any copyright, trademark, or proprietary notices on the Service.
        </P>
        <P>
          We welcome feedback and suggestions; to the extent permitted by law,
          any feedback you provide about the Service may be used by us without
          obligation to you.
        </P>
      </Section>

      <Section id="confidentiality" title="11. Confidentiality">
        <P>
          Each party may receive confidential information of the other in the
          course of using or providing the Service. “Confidential information”
          includes non-public business, technical, security, and compliance
          information, and the contents of workspace audit trails. Each party
          will use the other's confidential information only to perform its
          obligations under these Terms and will protect it with at least the
          same care used for its own confidential information (and no less than a
          reasonable degree of care). This obligation does not apply to
          information that is publicly available, independently developed, or
          required to be disclosed by law (in which case the receiving party
          will, where permitted, give advance notice).
        </P>
      </Section>

      <Section id="third-party" title="12. Third-party services">
        <P>
          The Service may integrate with or link to third-party services, such as
          file storage providers or donor portals, selected or enabled by you.
          These third-party services are governed by their own terms and privacy
          policies. We are not responsible for the availability, security, or
          content of third-party services, and your use of them is at your own
          risk. Where you enable a third-party integration, you grant us the
          limited permissions necessary to connect your workspace to that service
          on your behalf.
        </P>
      </Section>

      <Section id="availability" title="13. Availability and disclaimers">
        <P>
          We use commercially reasonable efforts to keep the Service available
          and secure, and we provide regular backups and verifiable audit trails.
          However, the Service is provided “as is” and “as available”, and we do
          not warrant that it will be uninterrupted, error-free, or free of
          harmful components. To the maximum extent permitted by law, we
          disclaim all implied warranties, including merchantability, fitness for
          a particular purpose, and non-infringement.
        </P>
        <P>
          The Service is a reporting and evidence-management tool. It does not
          provide legal, financial, accounting, or professional advice, and
          nothing in the Service (including AI-generated content or compliance
          checklists) constitutes such advice. You are responsible for making
          independent decisions about your reports, submissions, and compliance.
        </P>
        <P>
          Planned maintenance may temporarily affect availability; we will
          endeavor to provide advance notice for significant scheduled
          maintenance.
        </P>
        <P>
          You are responsible for maintaining your own copies and records of Your
          Data, including evidence files and reports required for your donor
          obligations. We recommend that you export critical data regularly using
          the Service's export features.
        </P>
        <P>
          No guarantee of donor acceptance. DonorDesk is a reporting,
          evidence-management, and compliance tool. We do not guarantee that any
          report generated with the Service will be accepted, approved, funded,
          or renewed by any donor, funder, or other third party. You are solely
          responsible for the content, quality, and accuracy of the reports you
          submit and for meeting your contractual obligations to donors and other
          stakeholders.
        </P>
      </Section>

      <Section id="liability" title="14. Limitation of liability">
        <P>
          To the maximum extent permitted by law, neither party will be liable to
          the other for any indirect, incidental, special, consequential, or
          punitive damages, or for loss of profits, revenue, data, or goodwill,
          arising out of or in connection with these Terms or the Service, even if
          advised of the possibility of such damages.
        </P>
        <P>
          To the maximum extent permitted by law, each party's total aggregate
          liability arising out of or in connection with these Terms will not
          exceed the amount paid by you for the Service in the twelve (12) months
          preceding the event giving rise to the claim, or, if you used the
          Service free of charge, one hundred US dollars (USD 100).
        </P>
        <P>
          Nothing in these Terms limits or excludes liability that cannot be
          limited or excluded under applicable law, including liability for
          fraud, death or personal injury caused by negligence, or gross
          negligence or willful misconduct.
        </P>
      </Section>

      <Section id="indemnification" title="15. Indemnification">
        <P>
          You will defend, indemnify, and hold harmless DonorDesk and its
          affiliates, officers, and employees from and against any claims,
          damages, and reasonable costs (including legal fees) arising out of or
          related to: (a) Your Data; (b) your use of the Service; (c) your
          violation of these Terms; or (d) your violation of applicable law or
          the rights of any third party.
        </P>
      </Section>

      <Section id="termination" title="16. Termination and suspension">
        <P>
          You may stop using the Service at any time and close your workspace in
          accordance with the Service's procedures. We may suspend or terminate
          your access to the Service: (a) if you breach these Terms and fail to
          remedy the breach within a reasonable period after notice; (b) if you
          violate our acceptable-use rules in a manner that threatens the
          security or integrity of the Service or other users; or (c) if we are
          required to do so by law.
        </P>
        <P>
          Upon termination, we will make Your Data available for export for a
          reasonable transition period in accordance with our standard export
          procedures, after which Your Data will be deleted in line with our{" "}
          <A href="/privacy">Privacy Policy</A>, unless we are legally required to
          retain it. We are not responsible for Your Data if you fail to export it
          before the end of the transition period.
        </P>
      </Section>

      <Section id="copyright" title="17. Copyright and takedown notices">
        <P>
          We respect the intellectual-property rights of others and expect our
          users to do the same. If you believe that content on the Service
          infringes your copyright, please send us a written notice that
          includes: (a) identification of the copyrighted work claimed to be
          infringed; (b) identification of the material and where it is located;
          (c) your contact information; (d) a statement of good-faith belief that
          the use is not authorized; and (e) a statement, under penalty of
          perjury, that the information is accurate and that you are authorized
          to act on behalf of the copyright owner.
        </P>
        <P>
          Send notices to{" "}
          <A href="mailto:legal@donordesk.online">legal@donordesk.online</A>.
          We will review valid notices and take reasonable steps to remove or
          disable access to infringing material. If you believe material you
          uploaded was removed by mistake, you may submit a counter-notification
          with the same contact address.
        </P>
      </Section>

      <Section id="beta" title="18. Beta and evaluation services">
        <P>
          Certain features of the Service may be provided on a beta, preview, or
          evaluation basis, or the Service as a whole may be offered during an
          evaluation period. Such features are provided “as is”, without the
          warranties described in these Terms, and may change, be discontinued,
          or be removed at any time without notice. We make no commitment that
          any beta or evaluation feature will become generally available.
        </P>
      </Section>

      <Section id="changes" title="19. Changes to these Terms">
        <P>
          We may update these Terms from time to time. We will post the revised
          Terms on this page and update the effective date above, and we will
          notify you by email or in-product notice where we have a way to reach
          you. Material changes will take effect thirty (30) days after notice,
          or earlier where required by law. Continued use of the Service after the
          effective date constitutes acceptance of the revised Terms. If you do
          not agree, you may stop using the Service before the changes take
          effect.
        </P>
      </Section>

      <Section id="governing-law" title="20. Governing law and disputes">
        <P>
          DonorDesk operates globally, and these Terms are designed to respect
          the laws applicable to users in their respective jurisdictions. These
          Terms are governed by the laws of the jurisdiction in which you, the
          Customer, are established, to the extent permitted by law, and by any
          applicable mandatory provisions of consumer-protection or
          data-protection law of your country of residence. Where the governing
          law cannot be determined or where you are not established in a
          jurisdiction with relevant mandatory protections, these Terms are
          governed by the laws of the Federal Republic of Germany.
        </P>
        <P>
          Dispute resolution. The parties will first attempt to resolve any
          dispute arising out of or in connection with these Terms through
          good-faith negotiation. If the dispute is not resolved within thirty
          (30) days of written notice, either party may refer the dispute to the
          competent courts of your (the Customer's) place of establishment or
          habitual residence. Nothing in this clause prevents either party from
          seeking injunctive or other equitable relief in any court of competent
          jurisdiction.
        </P>
      </Section>

      <Section id="general" title="21. General provisions">
        <Ul>
          <Li>
            <B>Severability.</B> If any provision of these Terms is held invalid
            or unenforceable, the remaining provisions will continue in full force
            and effect.
          </Li>
          <Li>
            <B>No waiver.</B> Failure to enforce any provision is not a waiver of
            that provision, and a waiver of a breach is not a waiver of any later
            breach.
          </Li>
          <Li>
            <B>Entire agreement.</B> These Terms, together with our Privacy
            Policy and any order forms or data processing addenda you sign,
            constitute the entire agreement between you and us regarding the
            Service.
          </Li>
          <Li>
            <B>Assignment.</B> You may not assign these Terms without our prior
            written consent. We may assign these Terms in connection with a
            merger, acquisition, or reorganization.
          </Li>
          <Li>
            <B>Force majeure.</B> Neither party is liable for delay or failure to
            perform caused by events beyond its reasonable control, including
            natural disasters, war, terrorism, pandemics, power failures, or
            internet disruptions.
          </Li>
          <Li>
            <B>Notices.</B> Notices under these Terms will be sent to the email
            address associated with your account, or to{" "}
            <A href="mailto:legal@donordesk.online">legal@donordesk.online</A>{" "}
            for notices to us.
          </Li>
        </Ul>
      </Section>

      <Section id="contact" title="22. Contact us">
        <P>
          If you have questions about these Terms, contact us at:
        </P>
        <div className="rounded-xl border border-brand-400/20 bg-brand-500/5 p-5">
          <p className="font-semibold text-white">DonorDesk.Online — Legal</p>
          <p className="mt-1 text-slate-300">
            Email:{" "}
            <A href="mailto:legal@donordesk.online">legal@donordesk.online</A>
          </p>
          <p className="mt-1 text-slate-300">
            Service: <span className="text-brand-300">https://donordesk.online</span>
          </p>
        </div>
      </Section>
    </LegalLayout>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28">
      <h2 className="text-2xl font-bold tracking-tight text-white">{title}</h2>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-slate-300">
        {children}
      </div>
    </section>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p>{children}</p>;
}

function B({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-slate-100">{children}</strong>;
}

function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="font-medium text-brand-300 underline decoration-brand-400/40 underline-offset-2 transition hover:text-brand-200"
    >
      {children}
    </a>
  );
}

function Ul({ children }: { children: ReactNode }) {
  return (
    <ul className="space-y-2.5 pl-5 marker:text-brand-400 marker:font-bold">
      {children}
    </ul>
  );
}

function Li({ children }: { children: ReactNode }) {
  return <li className="list-disc">{children}</li>;
}
