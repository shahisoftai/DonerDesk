"use client";

import { useState } from "react";
import type { InfographicSectionConfig } from "@donordesk/domain/contexts/infographics/index.js";
import { Dialog } from "@/components/feedback/Dialog";
import { Button } from "@/components/ui/Button";
import { BLOCK_CATALOG, BLOCK_GROUPS, SPAN_LABEL, blocksForScope, type DesignScopeName } from "../../domain/block-catalog";
import { MiniButton, PanelHeading } from "./primitives";

interface Props {
  sections: InfographicSectionConfig[];
  selected: number | undefined;
  onSelect: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onToggleHidden: (index: number) => void;
  onDuplicate: (index: number) => void;
  onRemove: (index: number) => void;
  onAdd: (kind: InfographicSectionConfig["kind"]) => void;
  /** How many Design-check findings each block has, to flag it in the list. */
  flagged: Readonly<Record<number, number>>;
  canEdit: boolean;
  scope?: DesignScopeName;
}

const spanOf = (s: InfographicSectionConfig): number => s.span ?? (s.size === "HALF" ? 6 : s.size === "THIRD" ? 4 : 12);

/** The blocks in order: drag to reorder (or use the arrows), hide, copy, remove; add another from the gallery. */
export function SectionList({ sections, selected, onSelect, onMove, onToggleHidden, onDuplicate, onRemove, onAdd, flagged, canEdit, scope = "PROJECT" }: Props) {
  const offered = blocksForScope(scope);
  const [dragging, setDragging] = useState<number | undefined>();
  const [over, setOver] = useState<number | undefined>();
  const [adding, setAdding] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<number | undefined>();
  return (
    <div>
      <PanelHeading>Blocks</PanelHeading>
      <ul className="space-y-1.5" aria-label="Blocks on the page">
        {sections.map((section, index) => {
          const info = BLOCK_CATALOG[section.kind];
          const label = section.title || info.label;
          return (
            <li
              key={`${section.kind}-${index}`}
              draggable={canEdit}
              onDragStart={(event) => {
                setDragging(index);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", String(index));
              }}
              onDragOver={(event) => {
                if (dragging === undefined) return;
                event.preventDefault();
                setOver(index);
              }}
              onDragLeave={() => setOver((current) => (current === index ? undefined : current))}
              onDrop={(event) => {
                event.preventDefault();
                if (dragging !== undefined && dragging !== index) onMove(dragging, index);
                setDragging(undefined);
                setOver(undefined);
              }}
              onDragEnd={() => (setDragging(undefined), setOver(undefined))}
              className={`rounded-lg border px-2 py-1.5 text-sm transition ${selected === index ? "border-brand-600 ring-2 ring-brand-100 dark:ring-brand-900/40" : "border-slate-200 dark:border-white/10"} ${over === index && dragging !== index ? "border-brand-500 bg-brand-50/60" : ""} ${section.hidden ? "opacity-50" : ""} ${dragging === index ? "opacity-40" : ""}`}
            >
              <div className="flex items-center gap-1">
                {canEdit && (
                  <span aria-hidden="true" className="cursor-grab select-none px-0.5 text-slate-400" title="Drag to move">
                    ⠿
                  </span>
                )}
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(index)} aria-current={selected === index}>
                  <span className="block truncate font-medium">{label}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {info.label} · {SPAN_LABEL[spanOf(section)] ?? ""}
                    {section.hidden ? " · hidden" : ""}
                  </span>
                </button>
                {flagged[index] ? (
                  <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800" title="The design check has something to say about this block">
                    {flagged[index]}
                  </span>
                ) : null}
              </div>
              {canEdit && (
                <div className="mt-1 flex flex-wrap justify-end gap-0.5">
                  <MiniButton label={`Move “${label}” up`} onClick={() => onMove(index, index - 1)} disabled={index === 0}>
                    ↑
                  </MiniButton>
                  <MiniButton label={`Move “${label}” down`} onClick={() => onMove(index, index + 1)} disabled={index === sections.length - 1}>
                    ↓
                  </MiniButton>
                  <MiniButton label={section.hidden ? `Show “${label}”` : `Hide “${label}”`} onClick={() => onToggleHidden(index)}>
                    {section.hidden ? "Show" : "Hide"}
                  </MiniButton>
                  <MiniButton label={`Copy “${label}”`} onClick={() => onDuplicate(index)}>
                    Copy
                  </MiniButton>
                  <MiniButton label={`Remove “${label}”`} onClick={() => setConfirmRemove(index)} disabled={sections.length <= 1}>
                    Remove
                  </MiniButton>
                </div>
              )}
              {confirmRemove === index && (
                <div role="alertdialog" aria-label={`Remove ${label}?`} className="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-800 dark:bg-red-950/30">
                  <p>Remove “{label}” from this design? You can undo it.</p>
                  <div className="mt-1.5 flex gap-2">
                    <Button size="sm" variant="danger" onClick={() => (onRemove(index), setConfirmRemove(undefined))}>
                      Remove
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(undefined)}>
                      Keep
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {canEdit && (
        <Button className="mt-2 w-full" variant="secondary" size="sm" onClick={() => setAdding(true)}>
          + Add a block
        </Button>
      )}
      <Dialog open={adding} onClose={() => setAdding(false)} title="Add a block" size="lg">
        <div className="space-y-4">
          {BLOCK_GROUPS.filter((group) => offered.some((kind) => BLOCK_CATALOG[kind].group === group.id)).map((group) => (
            <section key={group.id} aria-label={group.label}>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{group.label}</h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {offered.filter((kind) => BLOCK_CATALOG[kind].group === group.id).map((kind) => (
                  <li key={kind}>
                    <button
                      type="button"
                      className="w-full rounded-lg border border-slate-200 p-2.5 text-left hover:border-brand-500 hover:bg-brand-50/40 dark:border-white/10"
                      onClick={() => {
                        onAdd(kind);
                        setAdding(false);
                      }}
                    >
                      <span className="block text-sm font-medium">{BLOCK_CATALOG[kind].label}</span>
                      <span className="block text-xs text-slate-500">{BLOCK_CATALOG[kind].description}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Dialog>
    </div>
  );
}
