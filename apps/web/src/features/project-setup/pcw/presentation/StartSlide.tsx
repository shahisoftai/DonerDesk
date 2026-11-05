"use client";

import { useEffect, useState, useTransition } from "react";
import { applyPackAction, editDraftAction } from "@/lib/actions/project-setup-draft";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { SetupDraftView } from "@/lib/server/schemas-project-setup-draft";
import { startSuggestions } from "../domain/start-suggestions";
import { usePcwCopy } from "./usePcwCopy";
import { StartDocuments } from "./StartDocuments";
import { SECTOR_OPTIONS } from "../domain/pcw-view";

/**
 * Slide 1: donor, sector and country, then the sector's starting answers. The donor only labels the project: the starting
 * answers depend on the sector alone, and what a donor requires comes from the project's own documents and template.
 */
export function StartSlide({ id, view, onView }: { id: string; view: SetupDraftView; onView: (v: SetupDraftView) => void }) {
  const pcw = usePcwCopy();
  const PCW_COPY = pcw.c;
  const start = view.extras.start;
  const [donor, setDonor] = useState(start.donor ?? "");
  const [country, setCountry] = useState(start.country ?? "");
  // A reading fills donor and country after this page opened: show what the draft now holds (the reading only fills empty answers).
  useEffect(() => { setDonor(start.donor ?? ""); }, [start.donor]);
  useEffect(() => { setCountry(start.country ?? ""); }, [start.country]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = (patch: { donor?: string; sector?: string; country?: string }) =>
    startTransition(async () => {
      const r = await editDraftAction(id, { kind: "SET_START", patch });
      if (r.ok) { setError(null); onView(r.value); } else setError(r.error.message);
    });

  const usePack = () =>
    startTransition(async () => {
      const r = await applyPackAction(id);
      if (r.ok) { setError(null); setMessage(PCW_COPY.start.startingApplied(r.value.packLabel, r.value.filled)); onView(r.value.view); } else setError(r.error.message);
    });

  return (
    <div className="space-y-6">
      {view.status === "READY" && !start.withDocuments ? <StartDocuments carry={{ donor: donor || start.donor, sector: start.sector, country: country || start.country }} /> : null}
    <div className="grid gap-4 sm:grid-cols-3">
      {(() => {
        const found = startSuggestions(view);
        const offers = [
          found.donor && !start.donor ? { label: PCW_COPY.parity.useDonor(found.donor), apply: () => { setDonor(found.donor!); save({ donor: found.donor! }); } } : null,
          found.country && !start.country ? { label: PCW_COPY.parity.useCountry(found.country), apply: () => { setCountry(found.country!); save({ country: found.country! }); } } : null,
        ].filter((o): o is { label: string; apply: () => void } => o !== null);
        return offers.length > 0 ? (
          <div className="sm:col-span-full space-y-1 text-sm">
            <p className="text-slate-600 dark:text-slate-300">{PCW_COPY.parity.pointsIntro}</p>
            <div className="flex flex-wrap gap-2">{offers.map((o) => <button key={o.label} type="button" className="btn-secondary" onClick={o.apply}>{o.label}</button>)}</div>
          </div>
        ) : null;
      })()}
      <Field label={PCW_COPY.start.donor}>
        <Input value={donor} onChange={(e) => setDonor(e.target.value)} onBlur={() => donor.trim() !== (start.donor ?? "") && save({ donor: donor.trim() })} />
      </Field>
      <Field label={PCW_COPY.start.sector}>
        <Select value={start.sector ?? ""} onChange={(e) => save({ sector: e.target.value })}>
          <option value="" disabled>—</option>
          {SECTOR_OPTIONS.map((s) => <option key={s} value={s}>{PCW_COPY.common.sectors[s] ?? s}</option>)}
        </Select>
      </Field>
      <Field label={PCW_COPY.start.country}>
        <Input value={country} onChange={(e) => setCountry(e.target.value)} onBlur={() => country.trim() !== (start.country ?? "") && save({ country: country.trim() })} />
      </Field>
      <div className="sm:col-span-3 space-y-2">
        <p className="text-sm text-slate-600 dark:text-slate-300">{PCW_COPY.start.sectorsHelp}</p>
        <button type="button" className="btn-secondary" onClick={usePack} disabled={pending || !start.sector}>{PCW_COPY.start.useStarting}</button>
        {message ? <p role="status" className="text-sm text-slate-700 dark:text-slate-200">{message}</p> : null}
        {error ? <p role="alert" className="text-sm text-danger-600">{error}</p> : null}
      </div>
    </div>
    </div>
  );
}
