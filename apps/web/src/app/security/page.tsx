import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  alternates: { canonical: "/security" },
  title: "Security & Trust",
  description: "How DonorDesk isolates tenant data, which subprocessors we use, and how to request data export, deletion, or a DPA.",
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
        An overview of how DonorDesk isolates your organization&apos;s data, who processes it on our behalf, and how
        to exercise your data rights.
      </p>

      <Section title="Tenant data isolation">
        <p>
          Every tenant-scoped database table enforces Postgres row-level security (RLS): each row carries the
          owning organization&apos;s tenant ID, and the database itself — not just the application — refuses to
          return or modify a row unless the current session is scoped to that tenant. The application&apos;s
          database role has no bypass: RLS is enabled and forced on every tenant table, so a bug in application code
          cannot leak one organization&apos;s data into another&apos;s request.
        </p>
      </Section>

      <Section title="Subprocessors">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Creem</strong> — payment processing and subscription billing (merchant of record).</li>
          <li><strong>Google Drive</strong> — optional, tenant-selected evidence storage (link-first; DonorDesk never copies file contents by default).</li>
          <li><strong>Cloudflare R2</strong> — optional managed object storage for tenants that opt into DonorDesk-managed uploads.</li>
        </ul>
        <p>No subprocessor is engaged for a tenant&apos;s content unless that tenant&apos;s configuration selects it.</p>
      </Section>

      <Section title="Data export and deletion">
        <p>
          You can export your projects, reports, and evidence at any time from within the product. Downgrading or
          canceling a subscription never deletes data — your organization keeps read, export, and delete access on
          the free Starter tier. To request full account deletion, contact{" "}
          <a className="text-brand-600 hover:underline dark:text-brand-400" href="mailto:privacy@donordesk.online">
            privacy@donordesk.online
          </a>.
        </p>
      </Section>

      <Section title="Data processing agreement (DPA)">
        <p>
          Enterprise and Growth customers may request a signed Data Processing Agreement. Email{" "}
          <a className="text-brand-600 hover:underline dark:text-brand-400" href="mailto:privacy@donordesk.online">
            privacy@donordesk.online
          </a>{" "}
          or use the{" "}
          <Link className="text-brand-600 hover:underline dark:text-brand-400" href="/contact-sales">
            sales contact form
          </Link>
          .
        </p>
      </Section>

      <p className="mt-8 text-sm">
        See also our{" "}
        <Link className="text-brand-600 hover:underline dark:text-brand-400" href="/privacy">
          Privacy Policy
        </Link>{" "}
        and{" "}
        <Link className="text-brand-600 hover:underline dark:text-brand-400" href="/terms">
          Terms of Service
        </Link>
        .
      </p>
    </main>
  );
}
