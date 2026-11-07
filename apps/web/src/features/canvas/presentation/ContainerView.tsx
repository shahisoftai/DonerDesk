"use client";

import { useState, type ReactNode } from "react";
import { childrenOf, containerRole, type BlockInstance } from "@donordesk/domain/contexts/canvas/index.js";
import { Tile } from "@/components/ui/Tile";

interface Props {
  block: BlockInstance;
  /** Every block of the page: the container finds what it holds among them. */
  blocks: readonly BlockInstance[];
  /** Draws one held block; `itemKey` is given when the block is repeated for an item. */
  renderChild: (child: BlockInstance, itemKey?: string) => ReactNode;
  items: ReadonlyArray<{ key: string; label: string }> | undefined;
  editing: boolean;
}

const INNER = "grid grid-cols-1 gap-3 sm:grid-cols-12 sm:auto-rows-[5.5rem]";
const cell = (b: BlockInstance, key: string, node: ReactNode): ReactNode => (
  <div key={key} className="h-[var(--mh)] sm:h-auto sm:[grid-column:span_var(--w)] sm:[grid-row:span_var(--h)]" style={{ "--w": Math.min(12, b.bounds.w), "--h": b.bounds.h, "--mh": `${Math.max(b.bounds.h, 1) * 5.5}rem` } as React.CSSProperties}>{node}</div>
);

/** What a container block shows: a titled frame, tabs (one at a time), or its blocks once for each item it repeats for. The blocks it holds are drawn by the page. */
export function ContainerView({ block, blocks, renderChild, items, editing }: Props) {
  const role = containerRole(block.kind);
  const props = (block.props ?? {}) as { title?: string; titles?: string[]; over?: string };
  const [tab, setTab] = useState(0);
  const grid = (held: BlockInstance[], itemKey?: string) => (held.length === 0 ? null : <div className={INNER}>{held.map((c) => cell(c, `${c.id}${itemKey ?? ""}`, renderChild(c, itemKey)))}</div>);
  const emptyHint = editing ? "Nothing is inside yet. Choose a block and use “Put inside” in its settings." : null;

  if (role === "TABS") {
    const titles = Array.isArray(props.titles) ? props.titles : [];
    const active = Math.min(tab, Math.max(0, titles.length - 1));
    const held = childrenOf(blocks, block.id, active);
    return (
      <div className="h-full overflow-auto rounded-xl border border-slate-200 p-3 dark:border-slate-700" data-container="TABS">
        <div role="tablist" className="mb-3 flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700">
          {titles.map((t, i) => <button key={i} type="button" role="tab" aria-selected={i === active} onClick={() => setTab(i)} className={`border-b-2 px-3 py-1.5 text-sm ${i === active ? "border-sky-600 font-semibold" : "border-transparent text-slate-600 dark:text-slate-300"}`}>{t}</button>)}
        </div>
        <div role="tabpanel" aria-label={titles[active]}>{held.length > 0 ? grid(held) : emptyHint && <p className="text-xs text-slate-500">{emptyHint}</p>}</div>
      </div>
    );
  }
  if (role === "REPEAT") {
    const held = childrenOf(blocks, block.id);
    return (
      <div className="h-full space-y-4 overflow-auto rounded-xl border border-slate-200 p-3 dark:border-slate-700" data-container="REPEAT">
        {held.length === 0 && emptyHint && <p className="text-xs text-slate-500">{emptyHint}</p>}
        {held.length > 0 && items === undefined && <p className="text-sm italic text-slate-500">A repeat is not shown here.</p>}
        {held.length > 0 && items !== undefined && items.length === 0 && <p className="text-sm italic text-slate-500">Nothing to repeat for yet: {props.over === "PLACE" ? "this project has no places recorded" : "no project is visible"}.</p>}
        {held.length > 0 && (items ?? []).map((it) => <section key={it.key} aria-label={it.label} data-repeat-item={it.key}><h3 className="mb-2 text-sm font-semibold">{it.label}</h3>{grid(held, it.key)}</section>)}
      </div>
    );
  }
  const held = childrenOf(blocks, block.id);
  return (
    <Tile title={props.title || "Group"} status="ready" ariaLabel={props.title || "Group"} flush>
      <div className="h-full overflow-auto p-3" data-container="FRAME">{held.length > 0 ? grid(held) : emptyHint && <p className="text-xs text-slate-500">{emptyHint}</p>}</div>
    </Tile>
  );
}
