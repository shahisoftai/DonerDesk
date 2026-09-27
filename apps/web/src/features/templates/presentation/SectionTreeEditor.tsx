"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Switch } from "@/components/ui/Switch";
import { Field } from "@/components/ui/Field";
import { Badge } from "@/components/data/Badge";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import { UnsavedChangesGuard } from "@/components/editor/UnsavedChangesGuard";
import { cn } from "@/components/ui/cn";
import { updateTemplateSectionsAction } from "@/lib/actions/templates";
import type { TemplateSectionView } from "@/lib/server/schemas";
import { canIndent, indent, insertChild, insertSiblingAfter, MAX_LEVEL, moveDown, moveUp, outdent, removeAt } from "../domain/section-tree-ops";
import { ListEditor } from "./ListEditor";
import { TablesEditor } from "./TablesEditor";

const INPUT_TYPES = [
  { value: "NARRATIVE", label: "Narrative" },
  { value: "TABLE", label: "Table" },
  { value: "CHART", label: "Chart" },
  { value: "INDICATOR_TABLE", label: "Indicator table" },
  { value: "ANNEX", label: "Annex" },
  { value: "COMPLIANCE", label: "Compliance" },
] as const;

type Section = TemplateSectionView;

function newSection(): Section {
  return {
    id: crypto.randomUUID(),
    title: "New section",
    description: "",
    inputType: "NARRATIVE",
    required: true,
    evidenceNeeded: [],
    reviewStatus: "DRAFT",
    level: 1,
    mandatoryQuestions: [],
    requiredTables: [],
    includeInReport: true,
  };
}

function toPayload(s: Section) {
  const text = (v?: string) => (v?.trim() ? v.trim() : undefined);
  const list = (v: string[]) => v.map((x) => x.trim()).filter(Boolean);
  return {
    id: s.id,
    title: s.title.trim(),
    description: s.description.trim(),
    inputType: s.inputType,
    required: s.required,
    evidenceNeeded: list(s.evidenceNeeded),
    relatedLogframeElement: text(s.relatedLogframeElement),
    reviewStatus: s.reviewStatus,
    minWords: s.minWords,
    maxWords: s.maxWords,
    pageLimit: s.pageLimit,
    parentId: s.parentId,
    level: s.level,
    numbering: text(s.numbering),
    instructions: text(s.instructions),
    mandatoryQuestions: list(s.mandatoryQuestions),
    requiredTables: s.requiredTables
      .filter((t) => t.title.trim())
      .map((t) => ({ title: t.title.trim(), columns: list(t.columns), notes: text(t.notes) })),
    authorInstructions: text(s.authorInstructions),
    includeInReport: s.includeInReport,
    source: s.source,
    confidence: s.confidence,
  };
}

function problems(sections: Section[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const s of sections) {
    if (s.title.trim().length < 2) out.set(s.id, "Title must be at least 2 characters.");
    else if (s.minWords !== undefined && s.maxWords !== undefined && s.minWords > s.maxWords) out.set(s.id, "Minimum words cannot exceed maximum words.");
  }
  return out;
}

const numberOrUndefined = (v: string) => (v.trim() === "" ? undefined : Math.max(0, Math.floor(Number(v))));

export function SectionTreeEditor({
  templateId,
  initialSections,
  version,
  readOnly,
  logframeOptions,
  onSaved,
}: {
  templateId: string;
  initialSections: Section[];
  version: number;
  readOnly?: boolean;
  logframeOptions: Array<{ value: string; label: string }>;
  onSaved: (version: number) => void;
}) {
  const router = useRouter();
  const [sections, setSections] = useState<Section[]>(initialSections);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(initialSections.length <= 3 ? initialSections.map((s) => s.id) : []));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const issues = useMemo(() => problems(sections), [sections]);
  const pending = sections.filter((s) => s.reviewStatus !== "REVIEWED").length;

  const change = (next: Section[]) => {
    setSections(next);
    setDirty(true);
    setMessage(null);
  };
  const patch = (id: string, p: Partial<Section>) => change(sections.map((s) => (s.id === id ? { ...s, ...p } : s)));
  const toggle = (id: string) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const add = (index?: number, child = false) => {
    const node = newSection();
    const next = index === undefined ? [...sections, node] : child ? insertChild(sections, index, node) : insertSiblingAfter(sections, index, node);
    change(next);
    setExpanded((prev) => new Set(prev).add(node.id));
  };

  async function save() {
    if (issues.size > 0) {
      setMessage({ tone: "danger", text: "Fix the highlighted sections before saving." });
      setExpanded((prev) => new Set([...prev, ...issues.keys()]));
      return;
    }
    setSaving(true);
    setMessage(null);
    const r = await updateTemplateSectionsAction(templateId, sections.map(toPayload), version);
    setSaving(false);
    if (!r.ok) {
      setMessage({ tone: "danger", text: r.error.message });
      return;
    }
    setDirty(false);
    setMessage({ tone: "success", text: `Saved as version ${r.value.version}.` });
    onSaved(r.value.version);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <UnsavedChangesGuard dirty={dirty} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {sections.filter((s) => s.includeInReport).length} report section(s) · {pending === 0 ? "all reviewed" : `${pending} awaiting review`}
        </p>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" disabled={pending === 0} onClick={() => change(sections.map((s) => ({ ...s, reviewStatus: "REVIEWED" })))}>
              Accept all
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!sections.some((s) => s.reviewStatus !== "REVIEWED" && (s.confidence ?? 0) >= 0.75)}
              onClick={() => change(sections.map((s) => ((s.confidence ?? 0) >= 0.75 ? { ...s, reviewStatus: "REVIEWED" } : s)))}
            >
              Accept high-confidence
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => add()}>Add section</Button>
            <Button type="button" size="sm" onClick={save} pending={saving} disabled={!dirty || saving}>
              Save changes
            </Button>
          </div>
        )}
      </div>
      {message && <InlineAlert tone={message.tone} title={message.text} />}

      <ol className="space-y-2">
        {sections.map((s, i) => {
          const open = expanded.has(s.id);
          const issue = issues.get(s.id);
          return (
            <li key={s.id} style={{ marginLeft: `${(s.level - 1) * 1.5}rem` }}>
              <div className={cn("card !p-3", issue && "border-red-400 dark:border-red-500/60", !s.includeInReport && "opacity-75")}>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => toggle(s.id)} aria-expanded={open}>
                    <span aria-hidden className="text-xs text-slate-400">{open ? "▾" : "▸"}</span>
                    {s.numbering && <span className="text-sm text-slate-500">{s.numbering}</span>}
                    <span className="truncate font-medium">{s.title || "Untitled"}</span>
                  </button>
                  <Badge tone="neutral">{INPUT_TYPES.find((t) => t.value === s.inputType)?.label ?? s.inputType}</Badge>
                  {!s.includeInReport && <Badge tone="info" title="Guidance only: not a report section">Guidance</Badge>}
                  {!s.required && <Badge tone="neutral">Optional</Badge>}
                  {s.mandatoryQuestions.length > 0 && <Badge tone="ai">{s.mandatoryQuestions.length} question(s)</Badge>}
                  {s.requiredTables.length > 0 && <Badge tone="ai">{s.requiredTables.length} table(s)</Badge>}
                  {s.confidence !== undefined && (
                    <Badge tone={s.confidence >= 0.75 ? "success" : s.confidence >= 0.5 ? "warning" : "danger"} title="Extraction confidence">
                      {Math.round(s.confidence * 100)}%
                    </Badge>
                  )}
                  <label className="flex items-center gap-1 text-xs">
                    <Switch
                      checked={s.reviewStatus === "REVIEWED"}
                      onCheckedChange={(v) => patch(s.id, { reviewStatus: v ? "REVIEWED" : "DRAFT" })}
                      disabled={readOnly}
                      label={`Mark ${s.title} reviewed`}
                    />
                    {s.reviewStatus === "REVIEWED" ? "Reviewed" : "Review"}
                  </label>
                  {!readOnly && (
                    <div className="flex gap-0.5">
                      <Button type="button" size="sm" variant="ghost" aria-label="Move up" onClick={() => change(moveUp(sections, i))}>↑</Button>
                      <Button type="button" size="sm" variant="ghost" aria-label="Move down" onClick={() => change(moveDown(sections, i))}>↓</Button>
                      <Button type="button" size="sm" variant="ghost" aria-label="Make sub-section" disabled={!canIndent(sections, i)} onClick={() => change(indent(sections, i))}>→</Button>
                      <Button type="button" size="sm" variant="ghost" aria-label="Move out one level" disabled={!s.parentId} onClick={() => change(outdent(sections, i))}>←</Button>
                    </div>
                  )}
                </div>
                {issue && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{issue}</p>}

                {open && (
                  <fieldset disabled={readOnly} className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="grid gap-3 sm:grid-cols-[6rem_1fr] md:col-span-2">
                      <Field label="Numbering" htmlFor={`${s.id}-num`}>
                        <Input id={`${s.id}-num`} value={s.numbering ?? ""} onChange={(e) => patch(s.id, { numbering: e.target.value || undefined })} />
                      </Field>
                      <Field label="Title" htmlFor={`${s.id}-title`}>
                        <Input id={`${s.id}-title`} value={s.title} onChange={(e) => patch(s.id, { title: e.target.value })} />
                      </Field>
                    </div>
                    <Field label="Content type" htmlFor={`${s.id}-type`}>
                      <Select id={`${s.id}-type`} value={s.inputType} onChange={(e) => patch(s.id, { inputType: e.target.value as Section["inputType"] })}>
                        {INPUT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </Select>
                    </Field>
                    <div className="flex flex-wrap items-end gap-4 pb-1 text-sm">
                      <label className="flex items-center gap-2">
                        <Switch checked={s.required} onCheckedChange={(v) => patch(s.id, { required: v })} label="Required" /> Required by donor
                      </label>
                      <label className="flex items-center gap-2" title="Guidance-only parts of a template do not become report sections">
                        <Switch checked={s.includeInReport} onCheckedChange={(v) => patch(s.id, { includeInReport: v })} label="Include in report" /> Include in report
                      </label>
                    </div>
                    <div className="grid grid-cols-3 gap-2 md:col-span-2">
                      <Field label="Min words" htmlFor={`${s.id}-min`}>
                        <Input id={`${s.id}-min`} type="number" min={0} value={s.minWords ?? ""} onChange={(e) => patch(s.id, { minWords: numberOrUndefined(e.target.value) })} />
                      </Field>
                      <Field label="Max words" htmlFor={`${s.id}-max`}>
                        <Input id={`${s.id}-max`} type="number" min={1} value={s.maxWords ?? ""} onChange={(e) => patch(s.id, { maxWords: numberOrUndefined(e.target.value) || undefined })} />
                      </Field>
                      <Field label="Page limit" htmlFor={`${s.id}-pages`}>
                        <Input id={`${s.id}-pages`} type="number" min={1} value={s.pageLimit ?? ""} onChange={(e) => patch(s.id, { pageLimit: numberOrUndefined(e.target.value) || undefined })} />
                      </Field>
                    </div>
                    <Field label="Summary" htmlFor={`${s.id}-desc`} description="Short description shown to your team.">
                      <Input id={`${s.id}-desc`} value={s.description} onChange={(e) => patch(s.id, { description: e.target.value })} />
                    </Field>
                    <Field label="Related logframe element" htmlFor={`${s.id}-lf`}>
                      {logframeOptions.length > 0 ? (
                        <Select id={`${s.id}-lf`} value={s.relatedLogframeElement ?? ""} onChange={(e) => patch(s.id, { relatedLogframeElement: e.target.value || undefined })}>
                          <option value="">None</option>
                          {logframeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </Select>
                      ) : (
                        <Input id={`${s.id}-lf`} value={s.relatedLogframeElement ?? ""} onChange={(e) => patch(s.id, { relatedLogframeElement: e.target.value || undefined })} />
                      )}
                    </Field>
                    <div className="md:col-span-2">
                      <Field label="Donor instructions (sent to the AI writer)" htmlFor={`${s.id}-instr`} description="What the donor asks you to write in this section, in the donor's words.">
                        <Textarea id={`${s.id}-instr`} className="min-h-[90px]" value={s.instructions ?? ""} onChange={(e) => patch(s.id, { instructions: e.target.value || undefined })} />
                      </Field>
                    </div>
                    <div className="md:col-span-2">
                      <ListEditor
                        label="Mandatory questions"
                        hint="Each question is answered explicitly in the draft (and listed in its Q&A)."
                        items={s.mandatoryQuestions}
                        onChange={(v) => patch(s.id, { mandatoryQuestions: v })}
                        addLabel="Add question"
                        multiline
                      />
                    </div>
                    <ListEditor label="Evidence needed" items={s.evidenceNeeded} onChange={(v) => patch(s.id, { evidenceNeeded: v })} addLabel="Add evidence" />
                    <TablesEditor tables={s.requiredTables} onChange={(v) => patch(s.id, { requiredTables: v })} />
                    <div className="md:col-span-2">
                      <Field
                        label="Organisation guidance for the AI (optional)"
                        htmlFor={`${s.id}-author`}
                        description="Your own standing guidance for this section, e.g. emphasis or structure. Never extracted from the donor."
                      >
                        <Textarea id={`${s.id}-author`} className="min-h-[60px]" value={s.authorInstructions ?? ""} onChange={(e) => patch(s.id, { authorInstructions: e.target.value || undefined })} />
                      </Field>
                    </div>
                    {s.source && (
                      <details className="text-xs text-slate-600 dark:text-slate-400 md:col-span-2">
                        <summary className="cursor-pointer">Source in the template{s.source.page ? ` (page ${s.source.page})` : ""}</summary>
                        <blockquote className="mt-1 border-l-2 border-slate-300 pl-2 italic dark:border-white/20">{s.source.excerpt}</blockquote>
                      </details>
                    )}
                    {!readOnly && (
                      <div className="flex flex-wrap gap-2 md:col-span-2">
                        <Button type="button" size="sm" variant="secondary" onClick={() => add(i)}>Add section below</Button>
                        <Button type="button" size="sm" variant="secondary" disabled={s.level >= MAX_LEVEL} onClick={() => add(i, true)}>Add sub-section</Button>
                        <Button type="button" size="sm" variant="danger" onClick={() => change(removeAt(sections, i))}>
                          Delete{sections[i + 1] && sections[i + 1]!.level > s.level ? " with sub-sections" : ""}
                        </Button>
                      </div>
                    )}
                  </fieldset>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {sections.length === 0 && <div className="card text-sm text-slate-600 dark:text-slate-300">No sections yet. Add the donor&rsquo;s report sections to continue.</div>}
    </div>
  );
}
