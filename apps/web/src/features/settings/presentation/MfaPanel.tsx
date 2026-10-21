"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { beginMfaAction, enableMfaAction, disableMfaAction } from "@/lib/actions/mfa";
import { useActionState } from "@/lib/client/action-state";
import { useHydrated } from "@/lib/client/use-hydrated";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/feedback/InlineAlert";

const groupKey = (key: string): string => key.replace(/(.{4})/g, "$1 ").trim();

/** Two-step sign-in with an authenticator app: set it up, see the recovery codes once, turn it off with the password and a code. */
export function MfaPanel({ enabled, enabledAt, recoveryCodesLeft }: { enabled: boolean; enabledAt: string | null; recoveryCodesLeft: number }) {
  const router = useRouter();
  const state = useActionState();
  const hydrated = useHydrated();
  const [setup, setSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [password, setPassword] = useState("");
  const [offCode, setOffCode] = useState("");
  const [showOff, setShowOff] = useState(false);

  async function begin() {
    const result = await state.run(() => beginMfaAction());
    if (result) setSetup(result);
  }
  async function enable(e: React.FormEvent) {
    e.preventDefault();
    const result = await state.run(() => enableMfaAction(code));
    if (result) {
      setRecoveryCodes(result.recoveryCodes);
      setSetup(null);
      setCode("");
    }
  }
  async function disable(e: React.FormEvent) {
    e.preventDefault();
    const done = await state.run(() => disableMfaAction(password, offCode));
    if (done) {
      setPassword("");
      setOffCode("");
      setShowOff(false);
      router.refresh();
    }
  }

  return (
    <section className="card space-y-4" aria-labelledby="mfa-title">
      <div>
        <h2 id="mfa-title" className="text-sm font-semibold">Two-step sign-in</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          After your password, you also enter a 6-digit code from an authenticator app on your phone. Someone who learns your password still cannot sign in.
        </p>
      </div>

      {recoveryCodes && (
        <InlineAlert tone="warning" title="Save your recovery codes now">
          <p>Each code works once if you lose your phone. They are shown only this time.</p>
          <ul className="mt-2 grid grid-cols-2 gap-1 font-mono text-sm" aria-label="Recovery codes">
            {recoveryCodes.map((c) => <li key={c}>{c}</li>)}
          </ul>
          <Button className="mt-3" variant="secondary" size="sm" onClick={() => { setRecoveryCodes(null); router.refresh(); }}>I have saved them</Button>
        </InlineAlert>
      )}

      {!enabled && !setup && !recoveryCodes && (
        <Button disabled={!hydrated || state.busy} onClick={() => void begin()}>Set up two-step sign-in</Button>
      )}

      {setup && (
        <form onSubmit={(e) => void enable(e)} className="space-y-3">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-200">
            <li>Open an authenticator app (Google Authenticator, Microsoft Authenticator, Authy, 1Password, …).</li>
            <li>Add an account and enter this key: <strong className="font-mono">{groupKey(setup.secret)}</strong> (time-based, 6 digits). On a phone you can <a className="underline" href={setup.otpauthUri}>open it in your app</a>.</li>
            <li>Enter the 6-digit code the app shows.</li>
          </ol>
          <Field label="Code from the app" htmlFor="mfa-code" error={state.fields?.code?.[0]}>
            <Input id="mfa-code" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" required />
          </Field>
          <Button type="submit" disabled={!hydrated || state.busy}>Turn on</Button>
        </form>
      )}

      {enabled && !recoveryCodes && (
        <div className="space-y-3">
          <p className="text-sm">
            <strong>On</strong>{enabledAt ? ` since ${new Date(enabledAt).toLocaleDateString("en-GB")}` : ""}. {recoveryCodesLeft} recovery {recoveryCodesLeft === 1 ? "code" : "codes"} left.
            {recoveryCodesLeft <= 2 && " Turn it off and on again to get new ones."}
          </p>
          {!showOff ? (
            <Button variant="secondary" size="sm" disabled={!hydrated} onClick={() => setShowOff(true)}>Turn off</Button>
          ) : (
            <form onSubmit={(e) => void disable(e)} className="space-y-3">
              <Field label="Your password" htmlFor="mfa-off-password" error={state.fields?.password?.[0]}>
                <Input id="mfa-off-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </Field>
              <Field label="A code from the app, or a recovery code" htmlFor="mfa-off-code" error={state.fields?.code?.[0]}>
                <Input id="mfa-off-code" value={offCode} onChange={(e) => setOffCode(e.target.value)} autoComplete="one-time-code" required />
              </Field>
              <div className="flex gap-2">
                <Button type="submit" variant="secondary" disabled={!hydrated || state.busy}>Turn off two-step sign-in</Button>
                <Button type="button" variant="ghost" onClick={() => setShowOff(false)}>Cancel</Button>
              </div>
            </form>
          )}
        </div>
      )}
      {state.error && <p role="alert" className="text-xs text-danger-600">{state.error}</p>}
    </section>
  );
}
