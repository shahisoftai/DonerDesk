"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BENEFICIARY_AGE_LABEL, BENEFICIARY_SEX_LABEL } from "@donordesk/domain/contexts/workplan/index.js";
import { removeBeneficiaryAction, updateBeneficiaryAction } from "@/lib/actions/workplan";
import { useActionState } from "@/lib/client/action-state";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

type Person = { id: string; caseCode: string; sex: string; ageGroup: string; location: string; enrolledOn: string };

/** One person in the register: read, correct or remove. Removing asks once and also drops the links to activities. */
export function BeneficiaryRow({ person, canChange }: { person: Person; canChange: boolean }) {
  const router = useRouter();
  const state = useActionState();
  const [mode, setMode] = useState<"read" | "edit" | "remove">("read");
  const [caseCode, setCaseCode] = useState(person.caseCode);
  const [sex, setSex] = useState(person.sex);
  const [ageGroup, setAgeGroup] = useState(person.ageGroup);
  const [location, setLocation] = useState(person.location);
  const [enrolledOn, setEnrolledOn] = useState(person.enrolledOn);

  async function save() {
    // Consent was recorded when the person was added; correcting a field does not re-ask.
    const done = await state.run(() => updateBeneficiaryAction(person.id, { caseCode, sex, ageGroup, ...(location.trim() ? { location } : {}), enrolledOn, consentRecorded: true }));
    if (done) { setMode("read"); router.refresh(); }
  }
  async function remove() {
    const done = await state.run(() => removeBeneficiaryAction(person.id));
    if (done) router.refresh();
  }

  if (mode === "edit") {
    return (
      <tr>
        <td className="py-2 pr-3"><Input aria-label="Case code" value={caseCode} maxLength={30} onChange={(e) => setCaseCode(e.target.value)} /></td>
        <td className="py-2 pr-3"><Select aria-label="Sex" value={sex} onChange={(e) => setSex(e.target.value)}>{Object.entries(BENEFICIARY_SEX_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></td>
        <td className="py-2 pr-3"><Select aria-label="Age group" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)}>{Object.entries(BENEFICIARY_AGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></td>
        <td className="py-2 pr-3"><Input aria-label="Location" value={location} onChange={(e) => setLocation(e.target.value)} /></td>
        <td className="py-2 pr-3"><Input aria-label="Day they joined" type="date" value={enrolledOn} onChange={(e) => setEnrolledOn(e.target.value)} /></td>
        <td className="py-2 pr-3 whitespace-nowrap">
          <Button onClick={save} pending={state.busy} disabled={!caseCode.trim() || !enrolledOn}>Save</Button>{" "}
          <Button variant="ghost" onClick={() => { setMode("read"); setCaseCode(person.caseCode); }}>Cancel</Button>
          {state.error && <p role="alert" className="text-sm text-danger-600">{state.error}</p>}
        </td>
      </tr>
    );
  }
  return (
    <tr>
      <td className="py-2 pr-3 font-mono">{person.caseCode}</td>
      <td className="py-2 pr-3">{BENEFICIARY_SEX_LABEL[person.sex as keyof typeof BENEFICIARY_SEX_LABEL] ?? person.sex}</td>
      <td className="py-2 pr-3">{BENEFICIARY_AGE_LABEL[person.ageGroup as keyof typeof BENEFICIARY_AGE_LABEL] ?? person.ageGroup}</td>
      <td className="py-2 pr-3">{person.location || "—"}</td>
      <td className="py-2 pr-3">{person.enrolledOn}</td>
      <td className="py-2 pr-3 whitespace-nowrap">
        {canChange && mode === "read" && <><Button variant="ghost" onClick={() => setMode("edit")}>Edit</Button>{" "}<Button variant="ghost" onClick={() => setMode("remove")}>Remove</Button></>}
        {mode === "remove" && (
          <span className="text-sm">Remove this person and their activity links?{" "}
            <Button onClick={remove} pending={state.busy}>Remove</Button>{" "}<Button variant="ghost" onClick={() => setMode("read")}>Keep</Button>
            {state.error && <span role="alert" className="block text-danger-600">{state.error}</span>}
          </span>
        )}
      </td>
    </tr>
  );
}
