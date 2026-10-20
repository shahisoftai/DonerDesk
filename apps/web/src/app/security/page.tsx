import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "@/lib/legal-entity";

export const metadata: Metadata = {
  alternates: { canonical: "/security" },
  title: "Security & Trust",
  description: "How DonorDesk isolates tenant data, protects it, keeps an audit trail, backs it up, and who processes it on our behalf.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-300">{children}</div>
    </section>
  );
}

export default function SecurityPage() {
  return (
    <main className="mx-auto mt-12 max-w-2xl animate-fade-in px-6 pb-16">
      <h1 className="text-2xl font-bold">Security &amp; trust</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
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
          Sessions are held in a signed, http-only, secure cookie. Multi-factor authentication is available for
          platform administrators; it is not currently required or available for tenant accounts, and we say so here
          rather than implying otherwise.
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
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">/scim/v2/Users</code>.
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
          <a className="text-brand-600 hover:underline dark:text-brand-400" href={`mailto:${LEGAL.privacyEmail}`}>
            {LEGAL.privacyEmail}
          </a>
          . You can report a concern to the same address.
        </p>
      </Section>

      <Section title="Subprocessors">
        <p>
          We publish every third party that may process personal data in a customer workspace, including the AI
          providers used for report drafting and the one place your data is hosted, in the{" "}
          <Link className="text-brand-600 hover:underline dark:text-brand-400" href="/subprocessors">
            sub-processor list
          </Link>
          . No subprocessor is engaged for your content unless your configuration selects it.
        </p>
      </Section>

      <Section title="Data export and deletion">
        <p>
          You can export any report — with its evidence pack — at any time from within the product. To request a
          full copy of your organization&apos;s records, or full account deletion, contact{" "}
          <a className="text-brand-600 hover:underline dark:text-brand-400" href={`mailto:${LEGAL.privacyEmail}`}>
            {LEGAL.privacyEmail}
          </a>
          . Downgrading or canceling a subscription never deletes data: your organization keeps read, export and
          delete access on the free Starter tier.
        </p>
      </Section>

      <Section title="Data processing agreement (DPA)">
        <p>
          Enterprise and Growth customers may request a signed Data Processing Agreement. Email{" "}
          <a className="text-brand-600 hover:underline dark:text-brand-400" href={`mailto:${LEGAL.privacyEmail}`}>
            {LEGAL.privacyEmail}
          </a>{" "}
          or use the{" "}
          <Link className="text-brand-600 hover:underline dark:text-brand-400" href="/contact-sales">
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

      <p className="mt-8 text-sm">
        See also our{" "}
        <Link className="text-brand-600 hover:underline dark:text-brand-400" href="/privacy">
          Privacy Policy
        </Link>
        ,{" "}
        <Link className="text-brand-600 hover:underline dark:text-brand-400" href="/terms">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link className="text-brand-600 hover:underline dark:text-brand-400" href="/dpa">
          Data Processing Addendum
        </Link>
        .
      </p>
    </main>
  );
}
