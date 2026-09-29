import type { Metadata } from "next";
import Link from "next/link";
import { ContactSalesForm } from "./ContactSalesForm";

export const metadata: Metadata = {
  title: "Talk to Sales",
  description: "Tell us about your organization and reporting needs — DonorDesk's Enterprise team will follow up.",
};

export default function ContactSalesPage() {
  return (
    <main className="mx-auto mt-12 max-w-xl animate-fade-in px-6 pb-16">
      <h1 className="text-2xl font-bold">Talk to sales</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Tell us about your organization and reporting needs. Our Enterprise team will follow up by email.
      </p>
      <div className="card mt-6">
        <ContactSalesForm />
      </div>
      <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
        Prefer email?{" "}
        <a className="text-brand-600 hover:underline dark:text-brand-400" href="mailto:sales@donordesk.online">
          sales@donordesk.online
        </a>
      </p>
      <p className="mt-6 text-sm">
        <Link className="text-brand-600 hover:underline dark:text-brand-400" href="/pricing">
          Back to pricing
        </Link>
      </p>
    </main>
  );
}
