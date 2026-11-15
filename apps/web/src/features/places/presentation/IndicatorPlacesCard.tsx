"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { setIndicatorPlacesAction } from "@/lib/actions/place-tree";
import { useActionState } from "@/lib/client/action-state";
import { useHydrated } from "@/lib/client/use-hydrated";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import type { IndicatorPlacesDto } from "@/lib/server/schemas-place-tree";
import { PlacePicker, type PickerPlace } from "./picker/PlacePicker";

type Scope = "PROJECT" | "LEVEL" | "CHOSEN";
const SCOPES: ReadonlyArray<{ key: Scope; label: string; help: string }> = [
  { key: "PROJECT", label: "For the whole project", help: "One figure each period." },
  { key: "LEVEL", label: "In every area we work in, at a level", help: "One figure per district (or province, or site) of this project's areas." },
  { key: "CHOSEN", label: "At places I choose", help: "One figure per place you pick." },
];
const LEVELS = [{ v: 1, l: "Province" }, { v: 2, l: "District" }, { v: 3, l: "Sub-district" }, { v: 4, l: "Site" }];

/**
 * Where this indicator is measured (Phase 56). The rows a person fills in come from the project's areas and this choice; places that already
 * hold a figure always stay. A calculated indicator is worked out from others and is never typed by place.
 */
export function IndicatorPlacesCard({ indicatorId, projectId, data, choices, projectIds }: { indicatorId: string; projectId: string; data: IndicatorPlacesDto; choices: PickerPlace[]; projectIds: readonly string[] }) {
  const router = useRouter();
  const state = useActionState();
  const hydrated = useHydrated();
  const [scope, setScope] = useState<Scope>(data.setting.scope);
  const [level, setLevel] = useState<number>(data.setting.level ?? 2);
  const [chosen, setChosen] = useState<string[]>(data.setting.placeIds ?? []);
  const mine = useMemo(() => new Set(projectIds), [projectIds]);
  const byId = useMemo(() => new Map(choices.map((c) => [c.id, c])), [choices]);

  async function save() {
    const body = scope === "PROJECT" ? { scope } : scope === "LEVEL" ? { scope, level } : { scope, placeIds: chosen };
    const done = await state.run(() => setIndicatorPlacesAction(indicatorId, body));
    if (done !== undefined) router.refresh();
  }

  return (
    <section aria-labelledby={`where-${indicatorId}`} className="card space-y-3">
      <h2 id={`where-${indicatorId}`} className="section-title">Where is this measured?</h2>
      <fieldset className="space-y-1" disabled={!data.canEdit}>
        {SCOPES.map((s) => (
          <label key={s.key} className="flex items-start gap-2 text-sm">
            <input type="radio" name={`scope-${indicatorId}`} checked={scope === s.key} onChange={() => setScope(s.key)} className="mt-1" />
            <span><b>{s.label}</b> <span className="text-slate-500">{s.help}</span></span>
          </label>
        ))}
      </fieldset>
      {scope === "LEVEL" && data.canEdit && <div className="max-w-xs"><Field label="Level"><Select value={String(level)} onChange={(e) => setLevel(Number(e.target.value))}>{LEVELS.map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}</Select></Field></div>}
      {scope === "CHOSEN" && (
        <div className="space-y-2">
          <ul className="flex flex-wrap gap-2 text-sm">
            {chosen.map((cid) => <li key={cid} className="rounded-full border border-slate-300 px-2 py-0.5 dark:border-white/15">{byId.get(cid)?.path ?? cid}{data.canEdit && <button type="button" className="ms-1 text-xs" aria-label="Remove" onClick={() => setChosen(chosen.filter((x) => x !== cid))}>×</button>}</li>)}
          </ul>
          {data.canEdit && <PlacePicker projectId={projectId} choices={choices} projectIds={mine} chosen={chosen} max={50} onChoose={(c) => setChosen([...chosen, c.id])} />}
        </div>
      )}
      {data.canEdit && <Button type="button" disabled={!hydrated || state.busy || (scope === "CHOSEN" && chosen.length === 0)} onClick={() => void save()}>Save</Button>}
      <div className="text-sm">
        <p className="font-medium">Rows people fill in now</p>
        {data.setting.scope === "PROJECT" ? <p className="text-slate-600 dark:text-slate-300">One figure for the whole project.</p>
          : data.rows.length === 0 ? <p className="text-slate-600 dark:text-slate-300">None yet: choose this project&apos;s areas under Plan › Where we work.</p>
          : <ul className="mt-1 list-disc ps-5">{data.rows.map((r) => <li key={r.placeId}>{r.path}</li>)}</ul>}
      </div>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
    </section>
  );
}
