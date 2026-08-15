import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "The DonorDesk Privacy Policy explains what data the platform collects, how it is used and protected, and the rights users have under data protection laws worldwide.",
};

const TOC = [
  { id: "who-we-are", title: "Who we are" },
  { id: "scope", title: "Scope of this policy" },
  { id: "what-we-collect", title: "Information we collect" },
  { id: "how-we-use", title: "How we use information" },
  { id: "legal-basis", title: "Legal bases for processing" },
  { id: "ai-features", title: "AI-assisted features" },
  { id: "sharing", title: "Sharing and disclosure" },
  { id: "international", title: "International data transfers" },
  { id: "retention", title: "Data retention" },
  { id: "security", title: "Data security" },
  { id: "your-rights", title: "Your rights" },
  { id: "california", title: "California residents" },
  { id: "children", title: "Children's privacy" },
  { id: "third-party", title: "Third-party links and services" },
  { id: "cookies", title: "Cookies and similar technologies" },
  { id: "incidents", title: "Security incidents and vulnerability disclosure" },
  { id: "changes", title: "Changes to this policy" },
  { id: "contact", title: "Contact us" },
];

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      subtitle="Legal"
      updated="14 August 2026 (Version 1.0)"
      toc={TOC}
    >
      <Section id="who-we-are" title="1. Who we are">
        <P>
          DonorDesk.Online (“<B>DonorDesk</B>”, “<B>we</B>”, “<B>us</B>”, or “
          <B>our</B>”) provides a cloud-based platform that helps non-governmental
          organizations, humanitarian programmes, and their teams turn field
          evidence, activity records, and logframe data into audit-ready donor
          reports. We operate the website and service at{" "}
          <B>https://donerdesk.online</B> (the “<B>Service</B>”).
        </P>
        <P>
          This Privacy Policy explains what personal information we process, why
          we process it, how long we keep it, who we share it with, and the rights
          you have. We designed the Service to operate globally and to respect
          applicable data protection laws wherever our users are located.
        </P>
        <P>
          For any privacy question or request, contact our privacy team at{" "}
          <A href="mailto:legal@donerdesk.online">legal@donerdesk.online</A>.
        </P>
      </Section>

      <Section id="scope" title="2. Scope of this policy">
        <P>
          This policy applies to personal information processed by DonorDesk
          when you visit our website, create an account, or use the Service,
          including personal information our customers (organizations) upload or
          enter on behalf of their beneficiaries, staff, and partners.
        </P>
        <P>
          The Service is a multi-tenant platform. Organizations that subscribe to
          the Service (“<B>Customers</B>”) control the workspaces, projects,
          templates, logframes, evidence files, activity records, and reports they
          create. In most cases, the Customer is the <B>controller</B> (or
          equivalent role under applicable law) of the personal information inside
          its workspace, and DonorDesk acts as a <B>processor</B> (or equivalent
          role) on the Customer's instructions. DonorDesk is the controller of the
          information we collect about the Customer's own users (such as account
          and usage data) as described below.
        </P>
        <P>
          This policy does not create rights enforceable by third parties. If you
          are a beneficiary, donor, or other individual whose information appears
          inside an organization's workspace, you should first contact that
          organization about your data.
        </P>
      </Section>

      <Section id="what-we-collect" title="3. Information we collect">
        <P>We collect the following categories of personal information:</P>
        <Ul>
          <Li>
            <B>Account and identity data.</B> Name, email address, job title,
            organization name, language preference, and authentication
            credentials (including password hashes and, if enabled, third-party
            sign-in identifiers such as Google or organization SSO accounts).
          </Li>
          <Li>
            <B>Workspace and content data.</B> Information entered or uploaded
            into the Service by or on behalf of a Customer, including project
            details, donor templates, logframes, indicators, activity updates,
            evidence files (documents, spreadsheets, images, and other records),
            comments, report drafts, compliance records, and export artifacts.
            This content may contain personal information about staff, partners,
            beneficiaries, and other individuals, including — where a Customer
            chooses to include it — special-category data such as health, racial
            or ethnic origin, or other sensitive information collected for
            humanitarian purposes.
          </Li>
          <Li>
            <B>AI-assisted drafting data.</B> The prompts, source references, and
            content generated when you use AI-assisted drafting features. We
            record the model used, the prompt version, and source citations for
            every generated output so that outputs remain traceable and
            reviewable.
          </Li>
          <Li>
            <B>Usage and technical data.</B> IP address, device and browser type,
            operating system, pages visited, features used, timestamps, request
            identifiers, and error logs, collected automatically when you use the
            Service.
          </Li>
          <Li>
            <B>Communication data.</B> If you contact support or our teams, the
            content of your communications and any information you choose to
            provide.
          </Li>
        </Ul>
        <P>
          We do not require you to provide special-category or sensitive data.
          Where Customers choose to process such data in the Service, they are
          responsible for ensuring they have an appropriate legal basis and any
          required consents, and for configuring the Service in a manner
          consistent with the sensitivity of the data.
        </P>
      </Section>

      <Section id="how-we-use" title="4. How we use information">
        <P>We use the information we collect for the following purposes:</P>
        <Ul>
          <Li>
            <B>Providing and operating the Service.</B> Creating and managing
            accounts and workspaces; enabling projects, evidence management,
            reporting, compliance, export, and collaboration features; and
            delivering the functionality you request.
          </Li>
          <Li>
            <B>AI-assisted drafting.</B> Generating source-linked draft narrative
            from content and evidence you provide, so that drafts remain
            reviewable, editable, and tied to verified sources.
          </Li>
          <Li>
            <B>Security and integrity.</B> Detecting, preventing, and responding
            to abuse, unauthorized access, fraud, and security incidents;
            maintaining the immutable audit trail that records who did what in a
            workspace; and enforcing multi-tenant isolation so one organization
            can never access another's data.
          </Li>
          <Li>
            <B>Support and communication.</B> Responding to enquiries, providing
            product updates relevant to your use of the Service, and sending
            operational notices (for example, about availability or changes to
            the Service).
          </Li>
          <Li>
            <B>Improvement and analytics.</B> Understanding how the Service is
            used, measuring performance, and improving features and reliability.
          </Li>
          <Li>
            <B>Legal compliance.</B> Complying with legal obligations, resolving
            disputes, and enforcing our Terms of Service.
          </Li>
        </Ul>
        <P>
          We do not sell personal information and we do not use workspace content
          to advertise to third parties.
        </P>
      </Section>

      <Section id="legal-basis" title="5. Legal bases for processing">
        <P>
          Where the EU General Data Protection Regulation (GDPR), the UK GDPR,
          or similar laws apply, our legal bases for processing personal
          information are:
        </P>
        <Ul>
          <Li>
            <B>Performance of a contract.</B> Processing needed to provide the
            Service to you or your organization under our Terms of Service.
          </Li>
          <Li>
            <B>Legitimate interests.</B> Processing to keep the Service secure,
            maintain audit trails, prevent abuse, and improve our products, where
            our interests are not overridden by your rights and freedoms.
          </Li>
          <Li>
            <B>Legal obligation.</B> Processing required to comply with laws
            applicable to us.
          </Li>
          <Li>
            <B>Consent.</B> Where we rely on consent (for example, for optional
            cookies or direct marketing), you may withdraw consent at any time
            without affecting the lawfulness of processing carried out before
            withdrawal.
          </Li>
        </Ul>
        <P>
          Where a Customer uses the Service to process personal information, the
          Customer is responsible for establishing its own legal bases, and we
          process that information on the Customer's documented instructions.
        </P>
        <P>
          Where the GDPR or other applicable law requires a{" "}
          <B>data processing agreement</B> or equivalent safeguards, we make
          available a data processing addendum. Contact{" "}
          <A href="mailto:legal@donerdesk.online">legal@donerdesk.online</A>{" "}
          to request a copy.
        </P>
      </Section>

      <Section id="ai-features" title="6. AI-assisted features">
        <P>
          DonorDesk includes AI-assisted drafting that generates source-linked
          narrative based on content in your workspace. Important principles:
        </P>
        <Ul>
          <Li>
            Content you provide may be transmitted to a third-party AI service
            provider solely to generate the draft you request. We select and
            configure AI providers with the sensitivity of humanitarian data in
            mind and require them to process data only for the purpose of
            providing the generation service.
          </Li>
          <Li>
            Every AI output is recorded with the model used, prompt version, and
            source references, so that generated content is traceable, editable,
            and subject to human review and approval before use.
          </Li>
          <Li>
            AI-assisted features are assistive only. They do not make automated
            decisions that produce legal effects on individuals, and no report is
            final until reviewed and approved by your team.
          </Li>
          <Li>
            If your organization or your donor requires that data never leave a
            specific jurisdiction or that AI features be disabled, contact us to
            discuss configuration options.
          </Li>
        </Ul>
      </Section>

      <Section id="sharing" title="7. Sharing and disclosure">
        <P>We share personal information only in the following circumstances:</P>
        <Ul>
          <Li>
            <B>Service providers.</B> With third parties who help us operate the
            Service, such as infrastructure and hosting providers, storage
            providers (which may include per-tenant file storage), AI service
            providers, error monitoring, and email delivery providers. These
            providers are bound by confidentiality and data protection
            obligations and may process data only on our documented instructions.
          </Li>
          <Li>
            <B>Within your workspace.</B> With the users of your organization's
            workspace, in accordance with the role-based permissions your
            organization configures.
          </Li>
          <Li>
            <B>Legal requirements.</B> Where we are required to do so by law,
            regulation, legal process, or a government request, or where
            disclosure is necessary to protect the rights, property, or safety of
            DonorDesk, our users, or others.
          </Li>
          <Li>
            <B>Business transactions.</B> In connection with a merger,
            acquisition, reorganization, or sale of assets, in which case we will
            require the receiving party to honor the commitments in this policy.
          </Li>
          <Li>
            <B>With consent.</B> Where you have given us consent to share your
            information for a specific purpose.
          </Li>
        </Ul>
        <P>
          We do not sell, rent, or trade personal information, and we do not share
          workspace content with advertisers. A current list of our service
          providers and sub-processors is available on request from{" "}
          <A href="mailto:legal@donerdesk.online">legal@donerdesk.online</A>.
        </P>
      </Section>

      <Section id="international" title="8. International data transfers">
        <P>
          DonorDesk serves organizations globally. Data you provide may be
          processed on infrastructure located outside your country, including by
          service providers in other jurisdictions. Where personal information is
          transferred across borders, we rely on appropriate safeguards, including
          recognized adequacy decisions, standard contractual clauses (SCCs), or
          equivalent transfer mechanisms recognized under applicable law.
        </P>
        <P>
          If you would like to know more about the safeguards we apply to
          international transfers, or to obtain a copy where available, contact{" "}
          <A href="mailto:legal@donerdesk.online">legal@donerdesk.online</A>.
        </P>
      </Section>

      <Section id="retention" title="9. Data retention">
        <P>
          We retain personal information only for as long as necessary to fulfill
          the purposes described in this policy, to provide the Service, to
          comply with legal obligations, and to resolve disputes. In particular:
        </P>
        <Ul>
          <Li>
            <B>Account data</B> is retained while your account is active and
            deleted or anonymized within a reasonable period after account
            closure, unless we are legally required to retain it.
          </Li>
          <Li>
            <B>Workspace content</B> is retained for as long as the Customer
            maintains it and is deleted upon Customer instruction or after the
            Customer's agreement terminates, subject to applicable legal
            requirements and any backup recovery obligations.
          </Li>
          <Li>
            <B>Audit trail data</B> is retained as long as required for security,
            compliance, and dispute-resolution purposes, consistent with the
            immutable and verifiable nature of the audit chain.
          </Li>
          <Li>
            <B>Technical logs</B> are retained for a limited period (typically no
            longer than 12 months) unless a security investigation or legal
            obligation requires longer retention.
          </Li>
        </Ul>
        <P>
          When retention is no longer required, we delete or irreversibly
          anonymize the information in line with applicable law and our backup
          procedures.
        </P>
      </Section>

      <Section id="security" title="10. Data security">
        <P>
          We apply technical and organizational measures appropriate to the
          sensitivity of the data we process, including:
        </P>
        <Ul>
          <Li>
            Encryption of data in transit (TLS) and at rest where supported by our
            storage infrastructure.
          </Li>
          <Li>
            Multi-tenant architecture with tenant-scoped access control and
            row-level security, so that one organization's data is never visible
            to another.
          </Li>
          <Li>
            Role-based access controls and least-privilege permissions for both
            our users and our staff.
          </Li>
          <Li>
            An immutable, chained audit log that records every mutation with
            checksums, supporting verification and accountability.
          </Li>
          <Li>
            Access controls, security monitoring, and incident-response
            procedures designed to detect and respond to security events.
          </Li>
        </Ul>
        <P>
          No method of transmission or storage is completely secure. While we
          work to protect your information, we cannot guarantee absolute security,
          and you are responsible for safeguarding your own credentials and for
          the configuration of your workspace.
        </P>
      </Section>

      <Section id="your-rights" title="11. Your rights">
        <P>
          Depending on where you live, you may have rights over the personal
          information we hold about you, including the right to:
        </P>
        <Ul>
          <Li>Access a copy of your personal information.</Li>
          <Li>Correct inaccurate or incomplete information.</Li>
          <Li>Request erasure of your personal information.</Li>
          <Li>Restrict or object to certain processing.</Li>
          <Li>Receive your data in a portable, machine-readable format.</Li>
          <Li>Withdraw consent where processing is based on consent.</Li>
          <Li>Lodge a complaint with your local data protection authority.</Li>
        </Ul>
        <P>
          To exercise any of these rights, email{" "}
          <A href="mailto:legal@donerdesk.online">legal@donerdesk.online</A>.
          We will respond within the time period required by applicable law
          (typically 30 days, with extensions permitted by law) and may ask you to
          verify your identity or your authority to make the request.
        </P>
        <P>
          If you request access to or deletion of information inside an
          organization's workspace, we will verify that the request is authorized
          by the Customer that controls that workspace before acting. We will not
          delete a Customer's workspace content on the request of an individual
          unless we are legally required to do so or the Customer instructs it.
        </P>
      </Section>

      <Section id="california" title="12. California residents">
        <P>
          If you are a resident of California, the California Consumer Privacy
          Act (CCPA/CPRA) and related regulations provide additional rights. In
          the preceding 12 months we have collected the categories of personal
          information described in Section 3 and disclosed them for business
          purposes as described in Section 7. We do not sell or share personal
          information as those terms are defined by the CCPA, and we do not use
          sensitive personal information for purposes other than those permitted.
        </P>
        <P>
          California residents may request that we disclose the categories and
          specific pieces of personal information we have collected, delete
          personal information (subject to lawful exceptions), and correct
          inaccurate information. You may also exercise these rights through an
          authorized agent. Contact{" "}
          <A href="mailto:legal@donerdesk.online">legal@donerdesk.online</A>{" "}
          to make a request. We will not discriminate against you for exercising
          your privacy rights.
        </P>
      </Section>

      <Section id="children" title="13. Children's privacy">
        <P>
          The Service is intended for use by organizations and professionals and
          is not directed to children. We do not knowingly collect personal
          information directly from children. If a Customer works with data about
          children (for example, beneficiary records), the Customer is
          responsible for complying with all applicable laws and obtaining any
          required parental or guardian consent, and for using the Service in a
          manner consistent with child-protection obligations.
        </P>
        <P>
          If you believe we have unintentionally collected personal information
          from a child, contact{" "}
          <A href="mailto:legal@donerdesk.online">legal@donerdesk.online</A>{" "}
          and we will take reasonable steps to delete it.
        </P>
      </Section>

      <Section id="third-party" title="14. Third-party links and services">
        <P>
          The Service may contain links to third-party websites and services
          (for example, file storage providers or donor portals). This policy does
          not apply to those third parties. We are not responsible for their
          practices, and we encourage you to review their privacy policies.
        </P>
      </Section>

      <Section id="cookies" title="15. Cookies and similar technologies">
        <P>
          We use cookies and similar technologies (such as local storage and
          session identifiers) to operate and secure the Service. We use:
        </P>
        <Ul>
          <Li>
            <B>Essential cookies</B>, required for authentication, session
            management, and security. These cannot be disabled without breaking
            the Service.
          </Li>
          <Li>
            <B>Preference cookies</B>, such as your theme (light/dark) selection
            and language preference.
          </Li>
          <Li>
            <B>Analytics cookies</B>, where used, to understand aggregate usage
            so we can improve the Service.
          </Li>
        </Ul>
        <P>
          We do not use advertising or third-party tracking cookies for
          cross-site advertising. You can control or delete cookies through your
          browser settings; however, blocking essential cookies may prevent you
          from using the Service. Some browsers transmit “Do Not Track” signals;
          because there is no common standard, we currently do not change our
          practices in response to these signals, except where required by law.
        </P>
      </Section>

      <Section id="incidents" title="16. Security incidents and vulnerability disclosure">
        <P>
          If we become aware of a security incident that affects your personal
          information or your workspace, we will assess the impact and notify
          affected Customers without undue delay where required by applicable
          law, including a description of the nature of the incident and the
          steps we are taking to address it.
        </P>
        <P>
          We welcome responsible disclosure of security vulnerabilities in the
          Service. If you discover a potential vulnerability, please report it
          privately to{" "}
          <A href="mailto:legal@donerdesk.online">legal@donerdesk.online</A>{" "}
          with sufficient detail to allow us to reproduce and assess it. Please
          do not test in a way that degrades the Service or accesses other users'
          data. We will respond to valid reports and will not pursue legal action
          against researchers who act in good faith and in accordance with this
          clause.
        </P>
      </Section>

      <Section id="changes" title="17. Changes to this policy">
        <P>
          We may update this policy from time to time to reflect changes in our
          practices, technology, or legal obligations. When we make material
          changes, we will post the updated policy on this page and update the
          effective date above, and we will notify you by email or in-product
          notice where we have a way to reach you. Continued use of the Service
          after the effective date of the updated policy constitutes acceptance of
          the changes.
        </P>
      </Section>

      <Section id="contact" title="18. Contact us">
        <P>
          If you have questions, concerns, or complaints about this policy or our
          privacy practices, contact us at:
        </P>
        <div className="rounded-xl border border-brand-400/20 bg-brand-500/5 p-5">
          <p className="font-semibold text-white">DonorDesk.Online — Privacy Team</p>
          <p className="mt-1 text-slate-300">
            Email:{" "}
            <A href="mailto:legal@donerdesk.online">legal@donerdesk.online</A>
          </p>
          <p className="mt-1 text-slate-300">
            Service: <span className="text-brand-300">https://donerdesk.online</span>
          </p>
        </div>
        <P>
          We will acknowledge your request promptly and respond within the
          timeframe required by applicable law. You also have the right to lodge
          a complaint with the data protection authority in the country where you
          reside, where you work, or where an alleged infringement took place.
        </P>
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
