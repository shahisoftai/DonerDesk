"use client";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { signupAction } from "@/lib/auth-actions";
import { ThemeToggle } from "@/components/ThemeToggle";

const ORG_TYPES = ["LOCAL_NGO", "NATIONAL_NGO", "INGO", "UN_IMPLEMENTING_PARTNER", "CONSULTING_FIRM", "GOVERNMENT_UNIT", "OTHER"];
const SECTORS = ["NUTRITION", "FOOD_SECURITY", "WASH", "HEALTH", "PROTECTION", "EDUCATION", "LIVELIHOODS", "SHELTER", "MULTI_SECTOR", "OTHER"];
const DATA_REGIONS = ["DEFAULT", "EU", "US", "AFRICA", "ASIA"];

export default function SignupPage() {
  const [state, formAction] = useFormState<{ error: string | null }, FormData>(signupAction, { error: null });
  return (
    <main className="mx-auto mt-12 max-w-2xl animate-fade-in px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Create your workspace</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Step 1 of the setup wizard</p>
        </div>
        <ThemeToggle />
      </div>
      <form action={formAction} className="card mt-6 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Your name</label>
          <input name="name" className="input" required />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Data residency</label>
          <select name="dataResidency" className="input" defaultValue="DEFAULT">
            {DATA_REGIONS.map((region) => <option key={region} value={region}>{region === "DEFAULT" ? "Platform default" : region}</option>)}
          </select>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Restricts where organization data may be written.</p>
        </div>
        <label className="sm:col-span-2 flex items-start gap-2 text-sm">
          <input name="aiEnabled" type="checkbox" defaultChecked className="mt-1" />
          <span>Enable AI-assisted tagging and report drafting. This can be disabled without blocking manual reports.</span>
        </label>
        <div>
          <label className="label">Email</label>
          <input name="email" className="input" type="email" required />
        </div>
        <div>
          <label className="label">Password</label>
          <input name="password" className="input" type="password" minLength={8} required />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Organization name</label>
          <input name="orgName" className="input" required />
        </div>
        <div>
          <label className="label">Organization type</label>
          <select name="orgType" className="input" defaultValue="LOCAL_NGO">
            {ORG_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Country</label>
          <input name="country" className="input" required />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Primary sector</label>
          <select name="sector" className="input" defaultValue="NUTRITION">
            {SECTORS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        {state?.error && <p className="text-sm text-red-600 dark:text-red-400 sm:col-span-2">{state.error}</p>}
        <div className="sm:col-span-2 flex justify-end">
          <SubmitButton />
        </div>
      </form>
      <p className="mt-4 text-sm">
        Already have an account? <Link className="text-brand-600 hover:underline dark:text-brand-400" href="/login">Log in</Link>
      </p>
    </main>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button className="btn" disabled={pending}>{pending ? "Creating..." : "Create workspace"}</button>;
}
