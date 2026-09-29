"use client";

import { useFormState } from "react-dom";
import { acceptInvitationAction } from "@/lib/actions/invitations";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

export default function InviteAcceptForm({ token, role }: { token: string; role: string }) {
  const [state, formAction] = useFormState<{ error: string | null; fields?: Record<string, string[]> }, FormData>(
    acceptInvitationAction,
    { error: null },
  );
  const fields = state?.fields ?? {};
  const isViewer = role === "VIEWER";

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <Field label="Full name" htmlFor="invite-name" error={fields.name?.[0]}>
        <Input id="invite-name" name="name" autoComplete="name" required minLength={2} maxLength={120} />
      </Field>
      <Field
        label="Password"
        htmlFor="invite-password"
        error={fields.password?.[0]}
        hint={isViewer ? "Viewer accounts can browse projects and export reports." : undefined}
      >
        <Input id="invite-password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={200} />
      </Field>
      {state?.error && (
        <p role="alert" className="text-sm font-medium text-danger-700 dark:text-danger-400">{state.error}</p>
      )}
      <Button type="submit">Accept invitation</Button>
    </form>
  );
}
