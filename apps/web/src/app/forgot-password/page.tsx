"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { requestPasswordResetAction } from "@/lib/actions/password";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/feedback/InlineAlert";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await requestPasswordResetAction({ email });
      if (result.ok) {
        setSent(true);
      } else {
        setError(result.error);
      }
    });
  }

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
        {sent ? (
          <InlineAlert tone="success" title="Check your inbox">
            If an account exists for that email, we have sent a password reset link. The link expires in 60 minutes.
          </InlineAlert>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Enter the email address for your account and we will send you a reset link.
            </p>
            <Field label="Email" htmlFor="email">
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            {error && <InlineAlert tone="danger" title={error} />}
            <Button type="submit" disabled={pending}>
              {pending ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}
      </div>

      <p className="mt-4 text-sm">
        <Link className="text-brand-600 hover:underline dark:text-brand-400" href="/login">
          Back to log in
        </Link>
      </p>
    </main>
  );
}
