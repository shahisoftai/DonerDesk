"use client";
import { useState, useTransition } from "react";
import { changePasswordAction, requestPasswordResetAction } from "@/lib/actions/password";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/feedback/InlineAlert";

export function SecurityPanel({ email, ssoManaged }: { email: string | null; ssoManaged: boolean }) {
  const [linkState, setLinkState] = useState<"idle" | "sent" | "failed">("idle");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [changed, setChanged] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setChanged(false);
    if (newPassword !== confirmNewPassword) {
      setFieldErrors({ confirmNewPassword: ["Passwords do not match"] });
      return;
    }
    startTransition(async () => {
      const result = await changePasswordAction({ currentPassword, newPassword, confirmNewPassword });
      if (result.ok) {
        setChanged(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
      } else {
        setError(result.error);
        if (result.fields) setFieldErrors(result.fields);
      }
    });
  }

  return (
    <div className="mt-6 max-w-xl space-y-4">
      {changed && (
        <InlineAlert tone="success" title="Password updated">
          Your password has been changed. Use the new password next time you sign in.
        </InlineAlert>
      )}
      <form onSubmit={onSubmit} className="card space-y-4">
        <Field label="Current password" htmlFor="currentPassword" error={fieldErrors.currentPassword?.[0]}>
          <PasswordInput
            id="currentPassword"
            name="currentPassword"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            invalid={Boolean(fieldErrors.currentPassword)}
            required
          />
        </Field>
        <Field label="New password" htmlFor="newPassword" error={fieldErrors.newPassword?.[0]}>
          <PasswordInput
            id="newPassword"
            name="newPassword"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            invalid={Boolean(fieldErrors.newPassword)}
            minLength={12}
            required
          />
        </Field>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          At least 12 characters, with a mix of uppercase, lowercase, digits, or symbols.
        </p>
        <Field label="Confirm new password" htmlFor="confirmNewPassword" error={fieldErrors.confirmNewPassword?.[0]}>
          <PasswordInput
            id="confirmNewPassword"
            name="confirmNewPassword"
            autoComplete="new-password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            invalid={Boolean(fieldErrors.confirmNewPassword)}
            minLength={12}
            required
          />
        </Field>
        {error && <InlineAlert tone="danger" title={error} />}
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Change password"}
          </Button>
        </div>
      </form>
      {email && !ssoManaged && (
        <div className="mt-6 border-t border-slate-200 pt-4 dark:border-white/10">
          <h2 className="text-sm font-semibold">Forgot your current password?</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">We can email a reset link to {email}. It works once and expires soon.</p>
          {linkState === "sent" && <InlineAlert tone="success" title="Reset link sent">Check your inbox for an email from DonorDesk.</InlineAlert>}
          {linkState === "failed" && <InlineAlert tone="danger" title="We could not send the link. Please try again." />}
          <Button type="button" variant="secondary" className="mt-3" disabled={pending} onClick={() => startTransition(async () => { const r = await requestPasswordResetAction({ email }); setLinkState(r.ok ? "sent" : "failed"); })}>
            Email me a reset link
          </Button>
        </div>
      )}
    </div>
  );
}
