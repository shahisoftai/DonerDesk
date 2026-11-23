"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormDefinition, FormField, HowVerified } from "@donordesk/domain/contexts/collection/index.js";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { offerFacilities, placesForSubject, type DraftLine, type FacilityAssignment } from "../domain/assessment-flow";
import type { DraftFile, DraftStore } from "../ports/draft-store";
import { FormFiller, type FillFile, type FillOutcome } from "./filler/FormFiller";

const AUTOSAVE_MS = 2500;

export interface AssessmentFlowProps {
  form: { id: string; name: string; fields: ReadonlyArray<FormField>; definition: Omit<FormDefinition, "fields"> };
  places: ReadonlyArray<{ id: string; name: string; path: string; facility?: boolean | undefined }>;
  assignments: ReadonlyArray<FacilityAssignment>;
  /** Offer only the facilities given to this person (see `mustChooseFromAssigned`). */
  onlyAssigned?: boolean;
  /** A facility to open straight away (a link from Home): used only when the person may choose it. */
  initialPlaceId?: string | undefined;
  drafts: DraftStore;
  /** What the last accepted visit says about the facts the form carries forward; null when offline and the pack has none. */
  prefill: (placeId: string) => Promise<{ values: Record<string, unknown>; carried: string[] } | null>;
  uploadFile?: FillFile | undefined;
  online: boolean;
  onSubmit: (input: { placeId?: string; answers: Record<string, unknown>; how: Record<string, HowVerified>; startedAt: string }) => Promise<FillOutcome>;
  /** Leaves a facility unvisited with the reason (needs a connection). */
  onNotVisited?: ((placeId: string, reason: string) => Promise<FillOutcome>) | undefined;
  /** The files taken but not yet sent (offline): saved with the draft and given back when it is resumed. */
  files?: { snapshot(): Record<string, DraftFile>; restore(files: Record<string, DraftFile>): void } | undefined;
  /** Remembers the last facility per device and form. */
  rememberKey: string;
  submitLabel?: string | undefined;
}

/**
 * Filling an assessment from start to finish: choose the facility (the ones given to the person first), carry forward what the last visit
 * knows, continue a draft if there is one, save the draft while filling, and send. The rules live in `assessment-flow.ts` and the form
 * engine; where a draft is kept is the `DraftStore` passed in (the server online, the phone on the field app).
 */
export function AssessmentFlow(props: AssessmentFlowProps) {
  const { t, locale } = useI18n();
  const subject = props.form.definition.subject ?? "NONE";
  const [placeId, setPlaceId] = useState<string | undefined>(undefined);
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);
  const [start, setStart] = useState<{ answers: Record<string, unknown>; how: Record<string, HowVerified>; carried: string[]; resumed: boolean; startedAt: string } | null>(subject === "NONE" ? { answers: {}, how: {}, carried: [], resumed: false, startedAt: new Date().toISOString() } : null);
  const [line, setLine] = useState<DraftLine>({ kind: "NONE" });
  const [attempt, setAttempt] = useState(0);
  const [skipping, setSkipping] = useState<string | null>(null);
  const [skipNote, setSkipNote] = useState("");
  const [skipError, setSkipError] = useState("");
  const version = useRef<string | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ answers: Record<string, unknown>; how: Record<string, HowVerified> } | null>(null);
  const placeKey = placeId ?? "";

  const choices = useMemo(() => placesForSubject(props.places, subject).map((p) => ({ id: p.id, name: p.name, path: p.path })), [props.places, subject]);
  const onlyAssigned = props.onlyAssigned ?? false;
  const offered = useMemo(() => offerFacilities(choices, props.assignments, typed, 60, onlyAssigned), [choices, props.assignments, typed, onlyAssigned]);
  const chosen = choices.find((c) => c.id === placeId);

  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const next = pending.current;
    if (!next || !start) return;
    pending.current = null;
    setLine({ kind: "SAVING" });
    const r = await props.drafts.save(props.form.id, placeKey, { answers: next.answers, how: next.how, startedAt: start.startedAt, ...(props.files ? { files: props.files.snapshot() } : {}) }, version.current);
    if (r.ok) { version.current = r.updatedAt; setLine({ kind: "SAVED", at: new Date(r.updatedAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) }); }
    else setLine(r.reason === "CONFLICT" ? { kind: "CONFLICT" } : r.reason === "OFFLINE" ? { kind: "OFFLINE" } : { kind: "ERROR", message: r.message });
  }, [props.drafts, props.form.id, placeKey, start]);

  // Leaving the page with unsaved changes saves them first.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function changed(answers: Record<string, unknown>, how: Record<string, HowVerified>) {
    pending.current = { answers, how };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
  }

  async function choose(id: string) {
    setLoading(true); setLine({ kind: "NONE" });
    try {
      const draft = await props.drafts.load(props.form.id, id);
      if (draft) { props.files?.restore(draft.files ?? {}); version.current = draft.updatedAt; setStart({ answers: draft.answers, how: draft.how as Record<string, HowVerified>, carried: [], resumed: true, startedAt: draft.startedAt }); }
      else {
        version.current = undefined;
        const carried = await props.prefill(id).catch(() => null);
        setStart({ answers: carried?.values ?? {}, how: {}, carried: carried?.carried ?? [], resumed: false, startedAt: new Date().toISOString() });
      }
      setPlaceId(id);
      try { localStorage.setItem(`dd-assess-last:${props.rememberKey}`, id); } catch { /* storage unavailable: nothing is remembered */ }
    } finally { setLoading(false); }
  }

  // A link from Home names the facility: open it at once, once, when this person may choose it.
  const autoStarted = useRef(false);
  const wanted = props.initialPlaceId;
  useEffect(() => {
    if (autoStarted.current || !wanted || placeId || subject === "NONE") return;
    if (!choices.some((c) => c.id === wanted) || (onlyAssigned && !offered.some((o) => o.id === wanted))) return;
    autoStarted.current = true;
    void choose(wanted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, placeId, choices, offered, onlyAssigned, subject]);

  async function discard() {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    pending.current = null;
    await props.drafts.remove(props.form.id, placeKey);
    version.current = undefined; setLine({ kind: "NONE" });
    setStart({ answers: {}, how: {}, carried: [], resumed: false, startedAt: new Date().toISOString() });
    setAttempt((n) => n + 1);
  }

  async function send(answers: Record<string, unknown>, extra: { how: Record<string, HowVerified> }): Promise<FillOutcome> {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    pending.current = null;
    const outcome = await props.onSubmit({ ...(placeId ? { placeId } : {}), answers, how: extra.how, startedAt: start?.startedAt ?? new Date().toISOString() });
    if (outcome.ok) {
      await props.drafts.remove(props.form.id, placeKey);
      version.current = undefined; setLine({ kind: "NONE" });
      if (subject !== "NONE") { setPlaceId(undefined); setStart(null); } else setStart({ answers: {}, how: {}, carried: [], resumed: false, startedAt: new Date().toISOString() });
    }
    return outcome;
  }

  async function notVisited(id: string) {
    if (!props.onNotVisited) return;
    setSkipError("");
    const r = await props.onNotVisited(id, skipNote.trim());
    if (r.ok) { setSkipping(null); setSkipNote(""); } else setSkipError(r.message);
  }

  if (subject !== "NONE" && (!placeId || !start)) {
    return (
      <div className="space-y-3">
        <Field label={t("assess.facility.search")}><Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" /></Field>
        {choices.length === 0 && <p className="text-sm text-slate-500">{t("assess.facility.none")}</p>}
        {choices.length > 0 && onlyAssigned && offered.length === 0 && typed.trim() === "" && <p className="text-sm text-slate-500">{t("assess.facility.allDone")}</p>}
        <ul className="space-y-2" aria-label={t("assess.facility.pick")}>
          {offered.map((f) => (
            <li key={f.id} className="rounded-md border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-words font-medium">{f.name}</p>
                  <p className="break-words text-xs text-slate-500">{f.path}</p>
                  {f.assigned && <p className="text-xs text-brand-700 dark:text-brand-300">{t("assess.facility.assigned")}{f.dueOn ? ` · ${t("assess.facility.due", { date: f.dueOn })}` : ""}{f.status === "IN_PROGRESS" ? ` · ${t("assess.facility.started")}` : ""}</p>}
                </div>
                <div className="flex gap-2">
                  <Button type="button" onClick={() => void choose(f.id)} disabled={loading}>{t("assess.facility.start")}</Button>
                  {f.assigned && props.online && props.onNotVisited && <Button type="button" variant="ghost" onClick={() => { setSkipping(f.id); setSkipError(""); }}>{t("assess.facility.notVisited")}</Button>}
                </div>
              </div>
              {skipping === f.id && (
                <div className="mt-3 space-y-2">
                  <Field label={t("assess.facility.why")} error={skipError || undefined}><Input value={skipNote} onChange={(e) => setSkipNote(e.target.value)} maxLength={500} /></Field>
                  <div className="flex gap-2">
                    <Button type="button" onClick={() => void notVisited(f.id)} disabled={!skipNote.trim()}>{t("assess.facility.confirmSkip")}</Button>
                    <Button type="button" variant="ghost" onClick={() => setSkipping(null)}>{t("assess.cancel")}</Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (!start) return null;

  return (
    <div className="space-y-3">
      {subject !== "NONE" && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium">{chosen?.name}<span className="ms-2 text-xs font-normal text-slate-500">{chosen?.path}</span></p>
          <Button type="button" variant="ghost" onClick={() => { void flush(); setPlaceId(undefined); setStart(null); }}>{t("assess.facility.change")}</Button>
        </div>
      )}
      <FormFiller
        key={`${placeKey}:${attempt}`}
        fields={props.form.fields}
        definition={props.form.definition}
        initialAnswers={start.answers}
        initialHow={start.how}
        carried={start.carried}
        onChange={changed}
        uploadFile={props.uploadFile}
        placeNames={props.places.map((p) => p.name)}
        submitLabel={props.submitLabel}
        onSubmit={send}
        status={<DraftStatus line={line} resumed={start.resumed} online={props.online} onDiscard={() => void discard()} t={t} />}
      />
    </div>
  );
}

function DraftStatus({ line, resumed, online, onDiscard, t }: { line: DraftLine; resumed: boolean; online: boolean; onDiscard(): void; t(key: string, params?: Record<string, string | number>): string }) {
  const text = line.kind === "SAVING" ? t("assess.draft.saving") : line.kind === "SAVED" ? t(online ? "assess.draft.saved" : "assess.draft.savedHere", { time: line.at })
    : line.kind === "OFFLINE" ? t("assess.draft.offline") : line.kind === "CONFLICT" ? t("assess.draft.conflict") : line.kind === "ERROR" ? line.message : resumed ? t("assess.draft.resumed") : "";
  if (!text) return null;
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800">
      <span className={line.kind === "CONFLICT" || line.kind === "ERROR" ? "text-danger-600" : ""}>{text}</span>
      {(resumed || line.kind === "SAVED") && <Button type="button" variant="ghost" onClick={onDiscard}>{t("assess.draft.discard")}</Button>}
    </div>
  );
}
