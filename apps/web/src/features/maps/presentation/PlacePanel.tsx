"use client";

import type { PlacePanel as Panel } from "../domain/map-explorer";

/** What a click on the map shows: the place, its figures for every indicator, and the places inside it. */
export function PlacePanel({ panel, name, canDrill, onDrill, onSelect, onClose }: {
  panel: Panel | null;
  /** The clicked boundary's own name, shown even when no place in the list matches it. */
  name: string;
  canDrill: boolean;
  onDrill: () => void;
  onSelect: (placeId: string) => void;
  onClose: () => void;
}) {
  return (
    <aside aria-label="Place details" className="card space-y-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">{name}</h3>
          {panel && <p className="text-xs text-slate-500">{panel.path}</p>}
          {panel?.facility && <p className="text-xs font-medium text-slate-600 dark:text-slate-300">A facility</p>}
        </div>
        <button type="button" className="rounded border px-2" aria-label="Close place details" onClick={onClose}>×</button>
      </div>
      {canDrill && <button type="button" className="btn-secondary" onClick={onDrill}>Open its provinces</button>}
      {!panel || panel.figures.length === 0 ? (
        <p className="text-slate-600">No figures are recorded for this place.</p>
      ) : (
        <ul className="space-y-1">
          {panel.figures.map((f) => (
            <li key={f.indicatorId}>
              <span className="font-medium">{f.code}</span> {f.name}: {f.display === null ? "Not combined" : `${f.display}${f.unit ? ` ${f.unit}` : ""}`}
              {!f.verified && f.display !== null ? " (not verified yet)" : ""}
              {f.note && <span className="block text-xs text-slate-500">{f.note}</span>}
            </li>
          ))}
        </ul>
      )}
      {panel && panel.children.length > 0 && (
        <div>
          <p className="font-medium">Places inside</p>
          <ul className="mt-1 space-y-1">
            {panel.children.map((c) => (
              <li key={c.placeId}>
                <button type="button" className="underline" onClick={() => onSelect(c.placeId)}>{c.name}</button>: {c.display ?? "Not measured"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
