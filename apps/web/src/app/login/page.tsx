"use client";
import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { loginAction } from "@/lib/auth-actions";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/feedback/InlineAlert";

export default function LoginPage() {
  const [state, formAction] = useFormState<{ error: string | null; fields?: Record<string, string[]> }, FormData>(
    loginAction,
    { error: null },
  );
  const [next, setNext] = useState("");

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("next");
    setNext(value && value.startsWith("/") && !value.startsWith("//") ? value : "");
  }, []);

  const fields = state?.fields ?? {};

  return (
    <main className="mx-auto mt-24 max-w-md animate-fade-in px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Log in</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">DonorDesk workspace</p>
        </div>
        <ThemeToggle />
      </div>
      <form action={formAction} className="card mt-6 space-y-4">
        {process.env.NEXT_PUBLIC_OIDC_ENABLED === "true" && (
          <a className="btn block w-full text-center" href="/api/auth/oidc/start">
            Sign in with organization SSO
          </a>
        )}
        <input type="hidden" name="next" value={next} />
        <Field label="Email" htmlFor="email" error={fields.email?.[0]}>
          <Input id="email" name="email" type="email" autoComplete="email" defaultValue="admin@example.org" invalid={Boolean(fields.email)} required />
        </Field>
        <Field label="Password" htmlFor="password" error={fields.password?.[0]}>
          <Input id="password" name="password" type="password" autoComplete="current-password" defaultValue="password123" invalid={Boolean(fields.password)} required />
        </Field>
        {state?.error && (
          <InlineAlert tone="danger" title={state.error} />
        )}
        <SubmitButton />
        <p className="text-xs text-slate-500 dark:text-slate-400">Demo: admin@example.org / password123</p>
      </form>
      <p className="mt-4 text-sm">
        New here?{" "}
        <Link className="text-brand-600 hover:underline dark:text-brand-400" href="/signup">
          Create an organization
        </Link>
      </p>
      <p className="mt-2 text-sm">
        Forgot your password?{" "}
        <Link className="text-brand-600 hover:underline dark:text-brand-400" href="/forgot-password">
          Get help
        </Link>
      </p>
    </main>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" pending={pending}>
      {pending ? "Signing in..." : "Sign in"}
    </Button>
  );
}
