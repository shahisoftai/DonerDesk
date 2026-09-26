"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { validateResetTokenAction, confirmPasswordResetAction } from "@/lib/actions/password";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/feedback/InlineAlert";

type Phase = "checking" | "invalid" | "ready" | "done";

export default function ResetPasswordPage() {
  const params = useParams<{ token: string }>();
  const token = typeof params.token === "string" ? params.token : "";
  const [phase, setPhase] = useState<Phase>("checking");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await validateResetTokenAction(token);
      if (cancelled) return;
      if (result.ok && result.valid) setPhase("ready");
      else setPhase("invalid");
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldError(null);
    if (newPassword !== confirmNewPassword) {
      setFieldError("Passwords do not match");
      return;
    }
    startTransition(async () => {
      const result = await confirmPasswordResetAction({ token, newPassword });
      if (result.ok) {
        setPhase("done");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <main className="mx-auto mt-24 max-w-md animate-fade-in px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Choose a new password</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">DonorDesk workspace</p>
        </div>
        <ThemeToggle />
      </div>

      <div className="card mt-6 space-y-4">
        {phase === "checking" && (
          <p className="text-sm text-slate-600 dark:text-slate-400">Validating your reset link…</p>
        )}
        {phase === "invalid" && (
          <>
            <InlineAlert tone="danger" title="This reset link is invalid or has expired">
              Reset links expire after 60 minutes and can only be used once. Request a new link to continue.
            </InlineAlert>
            <Link className="btn block w-full text-center" href="/forgot-password">
              Request a new reset link
            </Link>
          </>
        )}
        {phase === "ready" && (
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="New password" htmlFor="newPassword" error={fieldError ?? undefined}>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                invalid={Boolean(fieldError)}
                minLength={12}
                required
              />
            </Field>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              At least 12 characters, with a mix of uppercase, lowercase, digits, or symbols.
            </p>
            <Field label="Confirm new password" htmlFor="confirmNewPassword">
              <Input
                id="confirmNewPassword"
                name="confirmNewPassword"
                type="password"
                autoComplete="new-password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                minLength={12}
                required
              />
            </Field>
            {error && <InlineAlert tone="danger" title={error} />}
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Reset password"}
            </Button>
          </form>
        )}
        {phase === "done" && (
          <>
            <InlineAlert tone="success" title="Password updated">
              Your password has been changed. You can now sign in with your new password.
            </InlineAlert>
            <Link className="btn block w-full text-center" href="/login">
              Go to log in
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
