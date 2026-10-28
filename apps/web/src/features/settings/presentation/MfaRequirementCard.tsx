"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateMfaRequirementAction } from "@/lib/actions/org";
import { useActionState } from "@/lib/client/action-state";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";

const GRACE: Array<[string, string]> = [["0", "From now"], ["7", "In a week"], ["14", "In two weeks"], ["30", "In a month"]];
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/** The administrator's switch: everyone in the organisation, partners included, must use two-step sign-in from a chosen day. */
export function MfaRequirementCard({ requiredFrom, ownEnabled, withoutCount, total, ssoManaged }: {
  requiredFrom: string | null; ownEnabled: boolean; withoutCount: number | null; total: number | null; ssoManaged: boolean;
}) {
  const router = useRouter();
  const act = useActionState();
  const [grace, setGrace] = useState("7");
  const required = requiredFrom !== null;
  const started = required && new Date(requiredFrom).getTime() <= Date.now();

  async function set(on: boolean) {
    if (await act.run(() => updateMfaRequirementAction({ required: on, graceDays: Number(grace) }))) router.refresh();
  }

  return (
    <section className="card space-y-3" aria-labelledby="mfa-req-title">
      <div>
        <h2 id="mfa-req-title" className="text-sm font-semibold">Require two-step sign-in for everyone</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          From the day you choose, everyone who signs in, staff and outside partners alike, must have two-step sign-in on. Someone who has not set it up can do nothing else until they have. Until that day they are reminded.
        </p>
      </div>
      {ssoManaged ? (
        <p className="text-sm">Your organization uses single sign-on, so two-step sign-in is managed by your identity provider and cannot be required here.</p>
      ) : (
        <>
          <p className="text-sm" role="status">
            {required ? (started ? `Required since ${day(requiredFrom!)}.` : `Will be required from ${day(requiredFrom!)}.`) : "Optional: each person chooses."}
            {withoutCount !== null && total !== null ? ` ${withoutCount === 0 ? "Everyone has it on." : `${withoutCount} of ${total} people have not set it up yet.`}` : ""}
          </p>
          {!required && (
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Required"><Select value={grace} onChange={(e) => setGrace(e.target.value)}>{GRACE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
              <Button onClick={() => void set(true)} pending={act.busy} disabled={act.busy || !ownEnabled}>Require it</Button>
              {!ownEnabled && <p className="basis-full text-xs text-slate-500">Turn on two-step sign-in for your own account above first, so you cannot be locked out.</p>}
            </div>
          )}
          {required && <Button variant="secondary" onClick={() => void set(false)} pending={act.busy} disabled={act.busy}>Make it optional again</Button>}
        </>
      )}
      {act.error && <p role="alert" className="text-sm text-danger-600">{act.error}</p>}
    </section>
  );
}
