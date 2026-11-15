"use client";

import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { parentChoices, pickerMatches, type PickerChoice } from "../../domain/picker-order";
import { InlineAddPlace } from "./InlineAddPlace";

export interface PickerPlace extends PickerChoice { adminLevel: number; kind: "POINT" | "AREA" }

/**
 * The one place picker (Phase 56), used wherever a record says where it happened. This project's places come first; the rest of the
 * organisation's list is offered labelled; a place nobody listed yet is added inline. It only chooses: the caller saves.
 */
export function PlacePicker({ projectId, choices, projectIds, chosen, onChoose, disabled, max }: {
  projectId: string;
  choices: readonly PickerPlace[];
  /** This project's places (open areas, everything inside them, places it already uses). */
  projectIds: ReadonlySet<string>;
  chosen: readonly string[];
  onChoose: (place: PickerChoice) => void;
  disabled?: boolean;
  max?: number;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState<PickerPlace[]>([]);
  const all = useMemo(() => [...choices, ...added], [choices, added]);
  const mine = useMemo(() => new Set([...projectIds, ...added.map((a) => a.id)]), [projectIds, added]);
  const matches = useMemo(() => pickerMatches(query, all, mine, chosen), [query, all, mine, chosen]);
  const full = max !== undefined && chosen.length >= max;

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs text-slate-500">Add a place</label>
      <Input id={id} value={query} onChange={(e) => { setQuery(e.target.value); setAdding(false); }} placeholder="Search places (this project's first)" className="max-w-sm" disabled={disabled || full} autoComplete="off" />
      {matches.length > 0 && (
        <ul className="flex flex-col items-start gap-1" aria-label="Matching places">
          {matches.map((c) => (
            <li key={c.id}>
              <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={() => { setQuery(""); onChoose(c); }}>
                {c.path}{c.group === "ORGANISATION" && <span className="ms-2 text-xs text-slate-500">· outside this project&apos;s areas</span>}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {query.trim() && !adding && (
        <button type="button" className="text-xs underline" disabled={disabled} onClick={() => setAdding(true)}>
          {matches.length === 0 ? `Add "${query.trim()}" as a new place` : "Not listed? Add a new place"}
        </button>
      )}
      {adding && (
        <InlineAddPlace
          projectId={projectId}
          initialName={query.trim()}
          parents={parentChoices(all, mine)}
          onCancel={() => setAdding(false)}
          onAdded={(r) => {
            const place: PickerPlace = { id: r.place.id, name: r.place.name, path: r.place.path, adminLevel: r.place.adminLevel, kind: r.place.kind };
            setAdded((cur) => [...cur.filter((x) => x.id !== place.id), place]);
            setAdding(false); setQuery("");
            onChoose(place);
          }}
        />
      )}
    </div>
  );
}
