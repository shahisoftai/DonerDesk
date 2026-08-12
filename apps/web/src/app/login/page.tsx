"use client";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { loginAction } from "@/lib/auth-actions";

export default function LoginPage() {
  const [state, formAction] = useFormState<{ error: string | null }, FormData>(loginAction, { error: null });
  return (
    <main className="mx-auto mt-24 max-w-md px-6">
      <h1 className="text-2xl font-bold">Log in</h1>
      <p className="mt-1 text-sm text-slate-500">DonorDesk workspace</p>
      <form action={formAction} className="card mt-6 space-y-4">
        {process.env.NEXT_PUBLIC_OIDC_ENABLED === "true" && (
          <a className="btn block w-full text-center" href="/api/auth/oidc/start">Sign in with organization SSO</a>
        )}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" className="input" type="email" defaultValue="admin@example.org" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" className="input" type="password" defaultValue="password123" required />
        </div>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <SubmitButton />
        <p className="text-xs text-slate-500">Demo: admin@example.org / password123</p>
      </form>
      <p className="mt-4 text-sm">
        New here? <Link className="text-brand-600 hover:underline" href="/signup">Create an organization</Link>
      </p>
    </main>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button className="btn w-full" disabled={pending}>{pending ? "Signing in..." : "Sign in"}</button>;
}
