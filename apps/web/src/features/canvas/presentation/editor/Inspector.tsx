"use client";

import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { useState } from "react";
import { definitionFor, projectOf, type AnimationSpec, type BlockInstance, type CanvasProblem } from "@donordesk/domain/contexts/canvas/index.js";
import type { ProjectOption } from "../CanvasWorkspace";
import { afterChange, PROP_FIELDS } from "../../domain/prop-fields";
import { setAt } from "../../domain/path";
import { AiDraftControl } from "./AiDraftControl";
import { MotionControl } from "./MotionControl";
import { FieldWidget, type IndicatorOption } from "./FieldWidget";

interface Props {
  block: BlockInstance;
  label: string;
  projects: ReadonlyArray<ProjectOption>;
  indicatorsByProject: Readonly<Record<string, ReadonlyArray<IndicatorOption>>>;
  fallbackProjectId: string | undefined;
  problems: ReadonlyArray<CanvasProblem>;
  language: string;
  /** The container blocks of the page this block could be put inside. */
  containers: ReadonlyArray<{ id: string; label: string; tabs: readonly string[] | null }>;
  onContainer: (container: { id: string; tab?: number } | undefined) => void;
  onProps: (props: unknown) => void;
  onProject: (projectId: string) => void;
  onBounds: (change: { x?: number; y?: number; w?: number; h?: number }) => void;
  onAlt: (alt: string, description: string) => void;
  onMotion: (motion: AnimationSpec | undefined) => void;
  onAction: (action: "duplicate" | "remove" | "hide" | "lock") => void;
}

const BTN = "rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-800";
const NUM = "w-16 rounded border border-slate-300 bg-white px-1 py-0.5 text-sm dark:border-slate-600 dark:bg-slate-900";

/** The settings of the selected block: where it sits, what it shows, how it is described. Everything a block offers is a row in the field table; "Advanced" edits any block as text. */
export function Inspector({ block, label, projects, indicatorsByProject, fallbackProjectId, problems, language, containers, onContainer, onProps, onProject, onBounds, onAlt, onMotion, onAction }: Props) {
  const { t } = useI18n();
  const def = definitionFor(block.kind);
  const needsProject = def?.slots.some((s) => s.slot === "project") === true;
  const projectId = projectOf(block.bindings) ?? fallbackProjectId;
  const indicators = (projectId && indicatorsByProject[projectId]) || [];
  const fields = PROP_FIELDS[block.kind] ?? [];
  const [advanced, setAdvanced] = useState(false);
  const [json, setJson] = useState<{ blockId: string; text: string; error: string | null } | null>(null);
  const locked = block.style?.locked === true;
  const mine = problems.filter((p) => p.blockId === block.id);

  const change = (path: string, value: unknown): void => onProps(afterChange(block.kind, setAt(block.props, path, value), path));
  const jsonText = json?.blockId === block.id ? json.text : JSON.stringify(block.props ?? {}, null, 2);

  return (
    <aside aria-label={`Settings for ${label}`} className="space-y-4 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700" data-testid="inspector">
      <header className="flex items-center justify-between"><h3 className="font-semibold">{label}</h3>{locked && <span className="text-xs text-slate-500">Locked</span>}</header>
      {mine.length > 0 && <ul className="space-y-1 rounded bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100" role="status">{mine.map((p, i) => <li key={i}>{p.message}</li>)}</ul>}

      {needsProject && (
        <div className="space-y-1">
          <label htmlFor="insp-project" className="block text-xs font-medium text-slate-600 dark:text-slate-300">Project this block reads</label>
          <select id="insp-project" className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900" value={projectId ?? ""} disabled={locked} onChange={(e) => e.target.value && onProject(e.target.value)}>
            <option value="">Choose a project</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      <fieldset disabled={locked} className="space-y-3">
        {fields.length === 0 && <p className="text-xs text-slate-500">This block has no settings of its own. Use Advanced to see all it holds.</p>}
        {fields.map((f) => <FieldWidget key={f.path} field={f} settings={block.props} indicators={indicators} onChange={change} />)}
        {def?.aiDraft && <AiDraftControl style={def.aiDraft} projectId={projectId} instruction={(block.props as { instruction?: string } | undefined)?.instruction} language={language} disabled={locked} onDraft={(text) => onProps({ ...(block.props as object), text, accepted: false })} />}
      </fieldset>

      {def?.container === undefined && containers.length > 0 && (
        <fieldset disabled={locked} className="space-y-1"><legend className="text-xs font-medium text-slate-600 dark:text-slate-300">{t("canvas.ui.putInside")}</legend>
          <select aria-label="Put inside" className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900" value={block.container?.id ?? ""} onChange={(e) => { const id = e.target.value; const holder = containers.find((c) => c.id === id); onContainer(id ? { id, ...(holder?.tabs ? { tab: 0 } : {}) } : undefined); }}>
            <option value="">{t("canvas.ui.onPage")}</option>{containers.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          {block.container && containers.find((c) => c.id === block.container?.id)?.tabs && (
            <select aria-label="Tab" className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900" value={block.container.tab ?? 0} onChange={(e) => onContainer({ id: block.container!.id, tab: Number(e.target.value) })}>
              {(containers.find((c) => c.id === block.container?.id)?.tabs ?? []).map((t, i) => <option key={i} value={i}>{t}</option>)}
            </select>)}
        </fieldset>
      )}

      <fieldset disabled={locked} className="space-y-2"><legend className="text-xs font-medium text-slate-600 dark:text-slate-300">{t("canvas.ui.placeSize")}</legend>
        <div className="flex flex-wrap items-center gap-2">
          {(["x", "y", "w", "h"] as const).map((k) => (
            <label key={k} className="flex items-center gap-1 text-xs">{{ x: "Column", y: "Row", w: "Wide", h: "High" }[k]}
              <input type="number" aria-label={{ x: "Column", y: "Row", w: "Width", h: "Height" }[k]} className={NUM} min={k === "w" || k === "h" ? 1 : 0} max={k === "x" ? 11 : k === "w" ? 12 : 400} value={block.bounds[k]} onChange={(e) => onBounds({ [k]: Number(e.target.value) })} />
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1">
        <label htmlFor="insp-alt" className="block text-xs font-medium text-slate-600 dark:text-slate-300">Description for people who cannot see it{def?.needsAlt ? " (needed before sharing)" : ""}</label>
        <input id="insp-alt" className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900" value={block.alt ?? ""} onChange={(e) => onAlt(e.target.value, block.description ?? "")} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={BTN} onClick={() => onAction("duplicate")}>{t("canvas.ui.duplicate")}</button>
        <button type="button" className={BTN} onClick={() => onAction("hide")}>{block.style?.hidden ? t("canvas.ui.show") : t("canvas.ui.hide")}</button>
        <button type="button" className={BTN} onClick={() => onAction("lock")}>{locked ? t("canvas.ui.unlock") : t("canvas.ui.lock")}</button>
        <button type="button" className={`${BTN} text-red-700`} onClick={() => onAction("remove")} disabled={locked}>{t("canvas.ui.remove")}</button>
      </div>

      <MotionControl block={block} disabled={locked} onMotion={onMotion} />
      <details open={advanced} onToggle={(e) => setAdvanced((e.target as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer text-xs font-medium text-slate-600 dark:text-slate-300">Advanced: all settings as text</summary>
        <textarea aria-label="All settings as text" rows={10} spellCheck={false} disabled={locked} className="mt-2 w-full rounded border border-slate-300 bg-white p-2 font-mono text-xs dark:border-slate-600 dark:bg-slate-900" value={jsonText}
          onChange={(e) => {
            const text = e.target.value;
            try { const parsed: unknown = JSON.parse(text); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) { setJson({ blockId: block.id, text, error: null }); onProps(parsed); } else setJson({ blockId: block.id, text, error: "The settings must be an object in braces." }); }
            catch { setJson({ blockId: block.id, text, error: "This is not valid yet; the block keeps its last good settings." }); }
          }} />
        {json?.blockId === block.id && json.error && <p role="alert" className="text-xs text-red-700">{json.error}</p>}
      </details>
    </aside>
  );
}
