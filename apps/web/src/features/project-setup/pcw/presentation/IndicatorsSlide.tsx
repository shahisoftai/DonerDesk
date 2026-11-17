"use client";

import { useState, useTransition } from "react";
import { changeResultsAction, editDraftAction, getDraftAction } from "@/lib/actions/project-setup-draft";
import { editSetupItemAction } from "@/lib/actions/project-setup";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { SetupDraftView } from "@/lib/server/schemas-project-setup-draft";
import { roleLabel } from "../domain/team-view";
import { usePcwCopy } from "./usePcwCopy";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { presetVocabulary } from "@donordesk/domain/contexts/logframe/framework-vocabulary.js";
import { BREAKDOWN_SUGGESTIONS, FREQUENCIES, FREQUENCY_GROUPS, INDICATOR_TYPES, INDICATOR_TYPE_LABEL, indicatorRows, indicatorTargets, parseBreakdown, suggestIndicatorSettings } from "../domain/results-view";
import { AcceptAllWaiting } from "./AcceptAllWaiting";
import { OriginBadge } from "./OriginBadge";
import { ExpandableList } from "@/components/ui/ExpandableList";
import { ApplyAll } from "./ApplyAll";
import { CarriedFacts } from "./CarriedFacts";
import { indicatorSummary } from "../domain/row-summary";
import { WizardLibraryPanel } from "@/features/sector-library/presentation/WizardLibraryPanel";

type Patch = Record<string, unknown>;

/** Slide 4: one card per indicator. Facts about the indicator change the proposal; who owns it and which way is better are the person's decisions. */
export function IndicatorsSlide({ id, view, onView }: { id: string; view: SetupDraftView; onView: (v: SetupDraftView) => void }) {
  const pcw = usePcwCopy();
  const { t } = useI18n();
  const PCW_COPY = pcw.c;
  const c = PCW_COPY.indicators;
  const sc = PCW_COPY.simple;
  const rows = indicatorRows(view);
  const chosen = view.extras.start.wording ? presetVocabulary(view.extras.start.wording) : undefined;
  const targets = indicatorTargets(view.logframe, chosen?.levels);
  const team = view.extras.team;
  const [name, setName] = useState("");
  const [result, setResult] = useState("");
  const [bulkFrequency, setBulkFrequency] = useState("");
  const [bulkBreakdown, setBulkBreakdown] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const suggestions = suggestIndicatorSettings(rows, team);
  const applySuggestions = () => startTransition(async () => {
    let latest: SetupDraftView | null = null;
    for (const s of suggestions) {
      if (s.type) { const r = await changeResultsAction(id, { kind: "EDIT_INDICATOR", path: s.path, patch: { type: s.type } }); if (!r.ok) return setError(r.error.message); latest = r.value; }
      const patch: Patch = { ...(s.direction ? { direction: s.direction, directionConfirmed: true } : {}), ...(s.ownerKey ? { ownerKey: s.ownerKey } : {}) };
      if (Object.keys(patch).length > 0) { const r = await editDraftAction(id, { kind: "SET_INDICATOR_SETUP", code: s.code, patch }); if (!r.ok) return setError(r.error.message); latest = r.value; }
    }
    if (latest) take(latest);
  });

  const take = (v: SetupDraftView) => { setError(null); onView(v); };
  const run = (work: () => Promise<{ ok: true; value: SetupDraftView } | { ok: false; error: { message: string } }>) =>
    startTransition(async () => { const r = await work(); if (r.ok) take(r.value); else setError(r.error.message); });
  const edit = (path: string, patch: Patch) => run(() => changeResultsAction(id, { kind: "EDIT_INDICATOR", path, patch }));
  const decide = (path: string, op: "ACCEPT" | "REJECT") =>
    startTransition(async () => {
      const r = await editSetupItemAction(id, { area: "INDICATORS", path, op });
      if (!r.ok) return setError(r.error.message);
      const fresh = await getDraftAction(id);
      if (fresh.ok) take(fresh.value); else setError(fresh.error.message);
    });
  const setup = (code: string | null, patch: Patch) => code && run(() => editDraftAction(id, { kind: "SET_INDICATOR_SETUP", code, patch }));
  const text = (path: string, field: string, value: string | null) => (e: { target: { value: string } }) => e.target.value.trim() !== (value ?? "") && edit(path, { [field]: e.target.value.trim() || null });

  return (
    <div className="space-y-6">
      <WizardLibraryPanel id={id} view={view} onView={onView} />
      <AcceptAllWaiting id={id} area="INDICATORS" items={view.indicators} onView={onView} onError={setError} />
      {suggestions.length > 0 ? (
        <section className="space-y-2 rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-900 dark:bg-brand-950/30" data-testid="suggest-defaults">
          <p className="text-sm">{c.suggestNote}</p>
          <button type="button" className="btn" disabled={pending} onClick={applySuggestions}>{c.suggest} ({suggestions.length})</button>
        </section>
      ) : null}
      <CarriedFacts view={view} slide="INDICATORS" />
      {rows.length > 1 ? (
        <div className="grid gap-3 md:grid-cols-2">
          <ApplyAll id={id} view={view} field="owner" label={sc.applyAll.owner} options={team.map((p) => ({ value: p.key, label: `${p.name} · ${roleLabel(p.role)}` }))} onView={onView} onError={setError} />
          <ApplyAll id={id} view={view} field="direction" label={sc.applyAll.direction} options={[{ value: "HIGHER", label: sc.applyAll.higher }, { value: "LOWER", label: sc.applyAll.lower }]} onView={onView} onError={setError} />
        </div>
      ) : null}
      {rows.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">{c.empty}</p> : null}
      <ExpandableList
        testId="indicator-list"
        labels={{ expandAll: sc.expandAll, collapseAll: sc.collapseAll, needs: sc.needs, open: sc.open, close: sc.close }}
        items={rows.map((row) => {
          const { item, value, ownerKey, direction, baselineNone } = row;
          const sum = indicatorSummary(row);
          return {
            id: item.path,
            needs: sum.gaps.map((g) => sc.indicatorGap[g] ?? g),
            summary: (
              <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                <span className="font-mono text-xs text-slate-500">{value.code}</span>
                <span className="font-medium">{value.title ?? ""}</span>
                {sum.facts.length > 0 ? <span className="text-xs text-slate-500 dark:text-slate-400">{sum.facts.join(" · ")}</span> : null}
              </span>
            ),
            actions: (
              <span className="flex flex-wrap items-center gap-2">
                {value.libraryId ? <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[11px] font-medium text-brand-900 dark:bg-brand-900/40 dark:text-brand-100" data-testid="library-badge">{t("lib.badge")}</span> : <OriginBadge origin={item.origin} id={id} source={item.source} quote={item.quote} />}
                {item.status === "PROPOSED" ? <button type="button" className="btn-secondary" disabled={pending} onClick={() => decide(item.path, "ACCEPT")}>{PCW_COPY.results.accept}</button> : null}
                <button type="button" className="btn-secondary" disabled={pending} onClick={() => decide(item.path, "REJECT")} aria-label={`${PCW_COPY.results.remove} ${value.title ?? ""}`}>{PCW_COPY.results.remove}</button>
              </span>
            ),
            body: (
              <>
                <Field label={c.name}><Input key={`n-${value.title}`} defaultValue={value.title ?? ""} onBlur={text(item.path, "title", value.title)} /></Field>
                {value.referenceText ? <p className="text-xs text-slate-600 dark:text-slate-300" data-testid="reference-tag">{t("lib.reference", { text: value.referenceText })}. {t("lib.referenceNote")}</p> : null}
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label={c.result}>
                    <Select value={value.logframeCode ?? ""} onChange={(e) => edit(item.path, { logframeCode: e.target.value || null })}>
                      <option value="">{c.choose}</option>
                      {targets.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
                    </Select>
                  </Field>
                  <Field label={c.type}>
                    <Select value={value.type ?? ""} onChange={(e) => edit(item.path, { type: e.target.value || null })}>
                      <option value="">{c.choose}</option>
                      {INDICATOR_TYPES.map((t) => <option key={t} value={t}>{INDICATOR_TYPE_LABEL[t]}</option>)}
                    </Select>
                  </Field>
                  <Field label={c.unit}><Input key={`u-${value.unit}`} defaultValue={value.unit ?? ""} onBlur={text(item.path, "unit", value.unit)} /></Field>
                  <Field label={c.baseline}><Input key={`b-${value.baseline}`} defaultValue={value.baseline ?? ""} disabled={baselineNone} onBlur={text(item.path, "baseline", value.baseline)} /></Field>
                  <Field label={c.target}><Input key={`t-${value.target}`} defaultValue={value.target ?? ""} onBlur={text(item.path, "target", value.target)} /></Field>
                  <Field label={c.frequency}>
                    <Select value={value.frequency ?? ""} onChange={(e) => edit(item.path, { frequency: e.target.value || null })}>
                      <option value="">{c.choose}</option>
                      <optgroup label={c.frequencyRegular}>{FREQUENCY_GROUPS.periodic.map((f) => <option key={f} value={f}>{f}</option>)}</optgroup>
                      <optgroup label={c.frequencyEvent}>{FREQUENCY_GROUPS.event.map((f) => <option key={f} value={f}>{f}</option>)}</optgroup>
                      {value.frequency && !FREQUENCIES.includes(value.frequency) ? <option value={value.frequency}>{value.frequency}</option> : null}
                    </Select>
                  </Field>
                  <Field label={c.breakdown}>
                    <Input key={`d-${(value.disaggregation ?? []).join()}`} defaultValue={(value.disaggregation ?? []).join(", ")} list="pcw-breakdowns" onBlur={(e) => edit(item.path, { disaggregation: parseBreakdown(e.target.value) })} />
                  </Field>
                  <Field label={c.owner}>
                    <Select value={ownerKey} onChange={(e) => e.target.value && setup(value.code, { ownerKey: e.target.value })}>
                      <option value="">{c.choose}</option>
                      {team.map((p) => <option key={p.key} value={p.key}>{p.name} · {roleLabel(p.role)}</option>)}
                    </Select>
                  </Field>
                  <Field label={c.direction}>
                    <Select value={direction} onChange={(e) => e.target.value && setup(value.code, { direction: e.target.value, directionConfirmed: true })}>
                      <option value="">{c.choose}</option>
                      <option value="HIGHER">{c.higher}</option>
                      <option value="LOWER">{c.lower}</option>
                    </Select>
                  </Field>
                  <label className="flex items-center gap-2 self-end text-sm"><Checkbox checked={baselineNone} onChange={(e) => setup(value.code, { baselineNone: e.target.checked })} /> {c.noBaseline}</label>
                </div>
              </>
            ),
          };
        })}
      />
      <datalist id="pcw-breakdowns">{BREAKDOWN_SUGGESTIONS.map((b) => <option key={b} value={b} />)}</datalist>

      <fieldset className="grid gap-3 rounded-xl border border-dashed border-slate-300 p-4 sm:grid-cols-3 dark:border-white/20">
        <legend className="px-1 text-sm font-semibold">{c.add}</legend>
        <Field label={c.name}><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label={c.result}>
          <Select value={result} onChange={(e) => setResult(e.target.value)}>
            <option value="">{c.choose}</option>
            {targets.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
          </Select>
        </Field>
        <div className="self-end"><button type="button" className="btn" disabled={pending || !name.trim()} onClick={() => { run(() => changeResultsAction(id, { kind: "ADD_INDICATOR", value: { title: name, logframeCode: result || null } })); setName(""); }}>{c.add}</button></div>
      </fieldset>

      {rows.length > 1 ? (
        <fieldset className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-3 dark:border-white/10">
          <legend className="px-1 text-sm font-semibold">{c.bulk}</legend>
          <Field label={c.applyFrequency}>
            <Select value={bulkFrequency} onChange={(e) => setBulkFrequency(e.target.value)}><option value="">{c.choose}</option><optgroup label={c.frequencyRegular}>{FREQUENCY_GROUPS.periodic.map((f) => <option key={f} value={f}>{f}</option>)}</optgroup><optgroup label={c.frequencyEvent}>{FREQUENCY_GROUPS.event.map((f) => <option key={f} value={f}>{f}</option>)}</optgroup></Select>
          </Field>
          <Field label={c.applyBreakdown}><Input value={bulkBreakdown} list="pcw-breakdowns" onChange={(e) => setBulkBreakdown(e.target.value)} /></Field>
          <div className="self-end">
            <button type="button" className="btn-secondary" disabled={pending || (!bulkFrequency && !parseBreakdown(bulkBreakdown))} onClick={() => run(() => changeResultsAction(id, { kind: "BULK_INDICATORS", ...(bulkFrequency ? { frequency: bulkFrequency } : {}), ...(parseBreakdown(bulkBreakdown) ? { disaggregation: parseBreakdown(bulkBreakdown) } : {}) }))}>{c.apply}</button>
          </div>
        </fieldset>
      ) : null}
      {error ? <p role="alert" className="text-sm text-danger-600">{error}</p> : null}
    </div>
  );
}
