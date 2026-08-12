"use client";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { InlineAlert } from "@/components/feedback/InlineAlert";

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto mt-24 max-w-md animate-fade-in px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reset your password</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">DonorDesk workspace</p>
        </div>
        <ThemeToggle />
      </div>

      <div className="card mt-6 space-y-4">
        <InlineAlert tone="info" title="Self-service reset is not available yet">
          Automated password reset is being rolled out. Until it is enabled, a workspace administrator can reset your
          password for you.
        </InlineAlert>
        <div className="text-sm text-slate-600 dark:text-slate-400">
          <p>If you have access to a DonorDesk admin account, ask them to update your account.</p>
          <p className="mt-2">
            If you are locked out entirely, contact your organization&rsquo;s DonorDesk administrator for assistance.
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm">
        <Link className="text-brand-600 hover:underline dark:text-brand-400" href="/login">
          Back to log in
        </Link>
      </p>
    </main>
  );
}
