"use client";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { signupAction } from "@/lib/auth-actions";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import { ORG_TYPE_OPTIONS, ORG_TYPE_LABEL, SECTOR_OPTIONS, SECTOR_LABEL, DATA_RESIDENCY_OPTIONS, DATA_RESIDENCY_LABEL } from "@/lib/labels";

type RequestedPlan = "starter" | "team" | "growth";

const PLAN_OPTIONS: { value: RequestedPlan; label: string; description: string }[] = [
  { value: "starter", label: "Starter — Free", description: "1 project, 1 seat, 1 GB storage, 5 AI drafts/month" },
  { value: "team", label: "Team — $59/mo", description: "5 projects, 5 seats, 25 GB, 100 AI drafts/month" },
  { value: "growth", label: "Growth — $149/mo", description: "20 projects, 15 seats, 100 GB, 500 AI drafts/month" },
];

export default function SignupForm({ initialPlan }: { initialPlan: RequestedPlan }) {
  const [state, formAction] = useFormState<{ error: string | null; fields?: Record<string, string[]> }, FormData>(
    signupAction,
    { error: null },
  );
  const fields = state?.fields ?? {};

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
        <input type="hidden" name="plan" value={initialPlan} />
        <div className="sm:col-span-2">
          <Field label="Plan" htmlFor="plan">
            <Select id="plan" name="plan" defaultValue={initialPlan}>
              {PLAN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {PLAN_OPTIONS.find((o) => o.value === initialPlan)?.description}
            </p>
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Your name" htmlFor="name" error={fields.name?.[0]}>
            <Input id="name" name="name" autoComplete="name" invalid={Boolean(fields.name)} required />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field
            label="Data residency"
            htmlFor="dataResidency"
            description="Restricts where organization data may be written."
          >
            <Select id="dataResidency" name="dataResidency" defaultValue="DEFAULT">
              {DATA_RESIDENCY_OPTIONS.map((region) => (
                <option key={region} value={region}>
                  {DATA_RESIDENCY_LABEL[region]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <label className="sm:col-span-2 flex items-start gap-2 text-sm">
          <input name="aiEnabled" type="checkbox" defaultChecked className="mt-1" />
          <span>Enable AI-assisted tagging and report drafting. This can be disabled without blocking manual reports.</span>
        </label>
        <Field label="Email" htmlFor="email" error={fields.email?.[0]}>
          <Input id="email" name="email" type="email" autoComplete="email" invalid={Boolean(fields.email)} required />
        </Field>
        <Field label="Password" htmlFor="password" error={fields.password?.[0]}>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} invalid={Boolean(fields.password)} required />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Organization name" htmlFor="orgName" error={fields.orgName?.[0]}>
            <Input id="orgName" name="orgName" autoComplete="organization" invalid={Boolean(fields.orgName)} required />
          </Field>
        </div>
        <Field label="Organization type" htmlFor="orgType">
          <Select id="orgType" name="orgType" defaultValue="LOCAL_NGO">
            {ORG_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {ORG_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Country" htmlFor="country" error={fields.country?.[0]}>
          <Input id="country" name="country" autoComplete="country-name" invalid={Boolean(fields.country)} required />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Primary sector" htmlFor="sector">
            <Select id="sector" name="sector" defaultValue="NUTRITION">
              {SECTOR_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {SECTOR_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {state?.error && (
          <div className="sm:col-span-2">
            <InlineAlert tone="danger" title={state.error} />
          </div>
        )}
        <div className="sm:col-span-2 flex justify-end">
          <SubmitButton />
        </div>
      </form>
      <p className="mt-4 text-sm">
        Already have an account?{" "}
        <Link className="text-brand-600 hover:underline dark:text-brand-400" href="/login">
          Log in
        </Link>
      </p>
    </main>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" pending={pending}>
      {pending ? "Creating..." : "Create workspace"}
    </Button>
  );
}
