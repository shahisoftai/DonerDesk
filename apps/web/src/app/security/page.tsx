import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "@/lib/legal-entity";
import { CookieConsentBanner } from "@/components/legal/CookieConsentBanner";
import { SiteShell } from "@/components/site/SiteShell";
import { SiteFooter } from "@/components/site/SiteFooter";

export const metadata: Metadata = {
  alternates: { canonical: "/security" },
  title: "Security & Trust",
  description: "How DonorDesk isolates tenant data, protects it, keeps an audit trail, backs it up, and who processes it on our behalf.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="sx-prose-section">
      <h2>{title}</h2>
      <div className="sx-stack" style={{ marginTop: 8, color: "var(--muted)", fontSize: 15 }}>{children}</div>
    </section>
  );
}

export default function SecurityPage() {
  return (
    <SiteShell footer={<SiteFooter />}>
    <div className="sx-wrap sx-prose">
      <h1>Security &amp; trust</h1>
      <p className="sx-lede" style={{ marginTop: 10 }}>
        How DonorDesk isolates your organization&apos;s data, protects it, keeps a record of what happened to it, and
        who processes it on our behalf.
      </p>

      <Section title="Tenant data isolation">
        <p>
          Every tenant-scoped database table enforces Postgres row-level security (RLS): each row carries the owning
          organization&apos;s tenant ID, and the database itself — not just the application — refuses to return or
          modify a row unless the current session is scoped to that tenant. The application&apos;s database role has
          no bypass: RLS is enabled and forced on every tenant table, so a bug in application code cannot leak one
          organization&apos;s data into another&apos;s request.
        </p>
        <p>
          One table is deliberately not tenant-isolated: the inbound billing inbox, which holds provider events before
          the customer they belong to is known. It is written only by our own billing service, never read through a
          customer-facing route, and it is listed as a global table in the deployment configuration.
        </p>
      </Section>

      <Section title="Access control">
        <p>
          Seven roles — administrator, project manager, M&amp;E officer, grants officer, field officer, compliance
          officer and viewer — each with an explicit permission set, enforced on the server for every request rather
          than only in the interface. Access to a project, and to the evidence files on it, is granted per person, and
          a file marked sensitive is not opened by a role that is not cleared for it. Every route in the authenticated
          API must name the permission it requires; a route that does not is refused, and a test fails the build if
          one is added without a rule.
        </p>
        <p>
          Sign-in uses a single sign-on provider (OIDC) or email and password, stored as a one-way bcrypt hash.
          Sessions are held in a signed, http-only, secure cookie. Staff accounts can turn on two-step sign-in: after
          the password, a 6-digit code from an authenticator app (time-based, TOTP), with single-use recovery codes.
          It is optional for each person, and an organisation's administrator can require it of everyone from a
          chosen day, outside partners included: from that day a person without it can only set it up. With single
          sign-on, two-step sign-in is managed by your own identity provider.
        </p>
      </Section>

      <Section title="Encryption">
        <p>
          Data in transit is protected by TLS, on the browser connection, the API connection and the connection to
          the database. Passwords are stored as one-way bcrypt hashes and are never recoverable. Platform secrets —
          tokens, encryption keys, SCIM credentials — are encrypted at rest with AES-256-GCM before they are written
          to the database.
        </p>
        <p>
          Uploaded evidence files are stored on encrypted host volumes. DonorDesk does not apply a second layer of
          encryption to file contents, so a tenant that needs its files encrypted with a key only it holds should use
          its own Google Drive, which DonorDesk links to rather than copies.
        </p>
      </Section>

      <Section title="Audit trail">
        <p>
          Every material change to programme data, evidence, permissions, reports and approvals is written to a
          per-organization audit log. Each entry carries a hash of the previous entry, so the log is a chain: an edit
          to history breaks it and is detectable. The log is append-only — the application&apos;s database role may add
          to it and read it, but cannot alter or erase a row — and a verification routine checks the chain.
        </p>
      </Section>

      <Section title="Backups and recovery">
        <p>
          DonorDesk takes an encrypted backup of the application databases and the evidence store every night, keeps
          a rolling window of them, and copies them off the host that produced them. The backup is restored into a
          scratch database on a schedule to prove it works; a backup that has never been restored is not a backup.
          The realistic recovery point is therefore 24 hours, and a full recovery onto a new host takes about an hour.
        </p>
        <p>
          We do not currently offer point-in-time recovery: the database write-ahead logs are not archived. If your
          programme needs that, tell us and we will say whether we can offer it.
        </p>
      </Section>

      <Section title="Single sign-on and user provisioning">
        <p>
          Enterprise customers can sign in through an OpenID Connect provider, and can have their people created and
          deprovisioned by their directory over SCIM 2.0 at{" "}
          <code className="sx-code">/scim/v2/Users</code>.
          A SCIM credential is issued per organization; only its hash is stored, and it is shown once. Revoking it
          stops the directory&apos;s access immediately, and every provisioning call is written to the audit trail.
        </p>
      </Section>

      <Section title="Vulnerability management">
        <p>
          Every pull request is checked by static analysis, a dependency audit that fails the build on a high-severity
          advisory, a filesystem scanner, and a software bill of materials is produced for each release. Secrets are
          scanned for in the repository, and the code is analysed for the usual injection and traversal patterns.
        </p>
      </Section>

      <Section title="Security incidents">
        <p>
          If a security incident affects your data, we notify you without undue delay and in any case within the
          period the law requires, at the email address on your account and at{" "}
          <a className="sx-link" href={`mailto:${LEGAL.privacyEmail}`}>
            {LEGAL.privacyEmail}
          </a>
          . You can report a concern to the same address.
        </p>
      </Section>

      <Section title="Subprocessors">
        <p>
          We publish every third party that may process personal data in a customer workspace, including the AI
          providers used for report drafting and the one place your data is hosted, in the{" "}
          <Link className="sx-link" href="/subprocessors">
            sub-processor list
          </Link>
          . No subprocessor is engaged for your content unless your configuration selects it.
        </p>
      </Section>

      <Section title="Data export and deletion">
        <p>
          You can export any report — with its evidence pack — at any time from within the product. To request a
          full copy of your organization&apos;s records, or full account deletion, contact{" "}
          <a className="sx-link" href={`mailto:${LEGAL.privacyEmail}`}>
            {LEGAL.privacyEmail}
          </a>
          . Downgrading or canceling a subscription never deletes data: your organization keeps read, export and
          delete access on the free Starter tier.
        </p>
      </Section>

      <Section title="Data processing agreement (DPA)">
        <p>
          Enterprise and Growth customers may request a signed Data Processing Agreement. Email{" "}
          <a className="sx-link" href={`mailto:${LEGAL.privacyEmail}`}>
            {LEGAL.privacyEmail}
          </a>{" "}
          or use the{" "}
          <Link className="sx-link" href="/contact-sales">
            sales contact form
          </Link>
          .
        </p>
      </Section>

      <Section title="Certifications">
        <p>
          DonorDesk does not hold external security certifications. We will not claim ISO 27001, SOC 2 or any other
          assurance we have not been audited for. The controls described on this page are implemented and tested in
          our own pipeline; where a customer needs independent assurance, we will say plainly what we can and cannot
          support today, and what we plan to have.
        </p>
      </Section>

      <p className="sx-fine" style={{ marginTop: 32 }}>
        See also our{" "}
        <Link className="sx-link" href="/privacy">
          Privacy Policy
        </Link>
        ,{" "}
        <Link className="sx-link" href="/terms">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link className="sx-link" href="/dpa">
          Data Processing Addendum
        </Link>
        .
      </p>
    </div>
      <CookieConsentBanner />
    </SiteShell>
  );
}
