"use client";

import { useState } from "react";
import type { BlockModel, PaintFrame } from "@donordesk/domain/contexts/canvas/index.js";
import { NothingToShow, readyOrNothing, screenText } from "./screen-text";

type Frame = { frame: PaintFrame };
const TONE: Record<string, string> = { info: "bg-sky-50 text-sky-900 border-sky-300 dark:bg-sky-950 dark:text-sky-100", good: "bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-100", warn: "bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-100" };

export function CalloutScreen({ model, frame }: Frame & { model: BlockModel<{ text: string; tone: string }> }) {
  if (model.state !== "ready") return <NothingToShow text={screenText(frame)} reason={model.reason} authoring />;
  if (!model.model.text.trim()) return <NothingToShow text={screenText(frame)} reason="Write the callout." authoring />;
  return <p role="note" className={`h-full rounded-lg border-s-4 px-4 py-3 text-sm ${TONE[model.model.tone] ?? TONE.info}`}>{model.model.text}</p>;
}

export function AiTextScreen(props: Frame & { model: BlockModel<{ text: string; accepted: boolean }> }) {
  return readyOrNothing(props, (m) => (
    <div className="space-y-2 px-4 py-3 text-sm">
      {m.text.split("\n").filter((l) => l.trim()).map((l, i) => <p key={i}>{l}</p>)}
      {!m.accepted && <p className="text-xs font-medium text-amber-700">Draft: not accepted yet.</p>}
    </div>
  ));
}

/** A group is a titled frame; what sits in it is laid out on the page like any other block. */
export function GroupScreen({ model }: Frame & { model: BlockModel<{ title?: string }> }) {
  const title = model.state === "ready" ? model.model.title : undefined;
  return <div className="h-full rounded-lg border border-dashed border-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-600" data-state="group">{title || "Group"}</div>;
}

export function TabsScreen({ model }: Frame & { model: BlockModel<{ titles: string[] }> }) {
  const [active, setActive] = useState(0);
  if (model.state !== "ready") return null;
  const titles = model.model.titles;
  return (
    <div className="px-3 py-2">
      <div role="tablist" className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {titles.map((t, i) => <button key={i} type="button" role="tab" aria-selected={i === active} onClick={() => setActive(i)} className={`border-b-2 px-3 py-1.5 text-sm ${i === active ? "border-sky-600 font-semibold" : "border-transparent text-slate-600"}`}>{t}</button>)}
      </div>
      <p role="tabpanel" className="px-1 py-3 text-xs text-slate-500">{titles[active]}</p>
    </div>
  );
}

const OVER = { PROJECT: "project", PLACE: "place", SECTOR: "sector" } as const;
export function RepeaterScreen({ model }: Frame & { model: BlockModel<{ over: keyof typeof OVER; limit: number }> }) {
  if (model.state !== "ready") return null;
  return <p className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">Repeats the blocks in it for up to {model.model.limit} {OVER[model.model.over] ?? "item"}s.</p>;
}

const FILTER_LABEL: Record<string, string> = { PERIOD: "Period", PROJECT: "Project", PLACE: "Place", SECTOR: "Sector", STATUS: "Status", DRAFTS: "Drafts" };
export function FilterBarScreen({ model }: Frame & { model: BlockModel<{ dimensions: string[] }> }) {
  if (model.state !== "ready") return null;
  return (
    <div className="hidden flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-900 [[data-editing]_&]:flex" role="group" aria-label="Filters">
      {model.model.dimensions.map((d) => <span key={d} className="rounded-full border border-slate-300 bg-white px-3 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-800">{FILTER_LABEL[d] ?? d}: all</span>)}
    </div>
  );
}
