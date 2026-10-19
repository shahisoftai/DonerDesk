"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BENEFICIARY_AGE_LABEL, BENEFICIARY_SEX_LABEL } from "@donordesk/domain/contexts/workplan/index.js";
import { registerBeneficiaryAction } from "@/lib/actions/workplan";
import { useActionState } from "@/lib/client/action-state";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

/**
 * Adds one person by case code. The form asks for no name, phone or ID number. Consent is a box that must be ticked.
 */
export function BeneficiaryForm({ projectId, today }: { projectId: string; today: string }) {
  const router = useRouter();
  const state = useActionState();
  const [caseCode, setCaseCode] = useState("");
  const [sex, setSex] = useState<"FEMALE" | "MALE">("FEMALE");
  const [ageGroup, setAgeGroup] = useState<keyof typeof BENEFICIARY_AGE_LABEL>("UNDER_5");
  const [location, setLocation] = useState("");
  const [enrolledOn, setEnrolledOn] = useState(today);
  const [consent, setConsent] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function save() {
    setNote(null);
    const done = await state.run(() => registerBeneficiaryAction(projectId, { caseCode, sex, ageGroup, ...(location.trim() ? { location } : {}), enrolledOn, consentRecorded: true }));
    if (done) {
      setCaseCode("");
      setNote(done.probableDuplicates.length ? `Saved. Check: ${done.probableDuplicates.join(", ")} looks like the same person. Keep both or change one.` : "Saved.");
      router.refresh();
    }
  }

  return (
    <section aria-labelledby="ben-add" className="max-w-2xl space-y-3">
      <h2 id="ben-add" className="text-base font-semibold">Add a person</h2>
      <p className="text-sm text-slate-600 dark:text-slate-300">Use a case code from your own register. Do not enter names, phone numbers or ID numbers here.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1"><label htmlFor="ben-code" className="block text-sm">Case code</label><Input id="ben-code" value={caseCode} maxLength={30} onChange={(e) => setCaseCode(e.target.value)} placeholder="e.g. NG-0042" /></div>
        <div className="space-y-1"><label htmlFor="ben-sex" className="block text-sm">Sex</label>
          <Select id="ben-sex" value={sex} onChange={(e) => setSex(e.target.value as typeof sex)}>{(Object.keys(BENEFICIARY_SEX_LABEL) as Array<keyof typeof BENEFICIARY_SEX_LABEL>).map((k) => <option key={k} value={k}>{BENEFICIARY_SEX_LABEL[k]}</option>)}</Select></div>
        <div className="space-y-1"><label htmlFor="ben-age" className="block text-sm">Age group</label>
          <Select id="ben-age" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value as typeof ageGroup)}>{(Object.keys(BENEFICIARY_AGE_LABEL) as Array<keyof typeof BENEFICIARY_AGE_LABEL>).map((k) => <option key={k} value={k}>{BENEFICIARY_AGE_LABEL[k]}</option>)}</Select></div>
        <div className="space-y-1"><label htmlFor="ben-loc" className="block text-sm">Location (optional)</label><Input id="ben-loc" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
        <div className="space-y-1"><label htmlFor="ben-day" className="block text-sm">Day they joined</label><Input id="ben-day" type="date" value={enrolledOn} onChange={(e) => setEnrolledOn(e.target.value)} /></div>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1 h-4 w-4" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>The person (or their guardian) agreed to be recorded for this programme.</span>
      </label>
      {state.error && <p role="alert" className="text-sm text-danger-600">{state.error}</p>}
      {note && <p role="status" className="text-sm">{note}</p>}
      <Button onClick={save} pending={state.busy} disabled={!caseCode.trim() || !consent || !enrolledOn}>Save the person</Button>
    </section>
  );
}
