"use client";

import { useCallback, useMemo, useState } from "react";
import { localizeForm, validateSubmission, type FormDefinition, type FormField, type HowVerified } from "@donordesk/domain/contexts/collection/index.js";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { formLevelProblems, problemsByPath, sectionProgress, sectionsOf } from "../../domain/filler-state";
import type { FieldViewProps, FillContext } from "./field-types";
import { FIELD_VIEWS } from "./fields/index";
import { ScorePanel } from "./ScorePanel";
import { SectionNav } from "./SectionNav";

export type FillOutcome = { ok: true } | { ok: false; message: string };
export type FillFile = (file: File, fieldKey: string) => Promise<{ ok: true; id: string; name: string } | { ok: false; message: string }>;

export interface FormFillerProps {
  fields: ReadonlyArray<FormField>;
  /** The rest of the form's definition (rules across answers, score, languages); absent for an older, simple form. */
  definition?: Omit<FormDefinition, "fields"> | undefined;
  onSubmit: (answers: Record<string, unknown>, extra: { submitterName?: string; how: Record<string, HowVerified> }) => Promise<FillOutcome>;
  uploadFile?: FillFile | undefined;
  placeNames?: ReadonlyArray<string> | undefined;
  submitLabel?: string | undefined;
  withName?: boolean | undefined;
  /** Answers to start from (a draft, or facts carried from the last visit) and how they were established. */
  initialAnswers?: Record<string, unknown> | undefined;
  initialHow?: Record<string, HowVerified> | undefined;
  /** Told after every change, so a draft can be saved; never called while the form is being sent. */
  onChange?: ((answers: Record<string, unknown>, how: Record<string, HowVerified>) => void) | undefined;
  /** Question keys carried from the last visit: shown with a note until the person changes them. */
  carried?: ReadonlyArray<string> | undefined;
  /** Where the draft stands ("Saved 10:42"), drawn above the form. */
  status?: React.ReactNode;
  readOnly?: boolean | undefined;
}

/**
 * One form, filled in. It asks the same rules the server enforces, so a question appears and disappears as the answers change and a problem
 * is shown beside its question before anything is sent. A long form is shown a section at a time with a contents list; a form with a score
 * shows it growing. Which control a question gets is `FIELD_VIEWS`; this component decides none of it.
 */
export function FormFiller(props: FormFillerProps) {
  const { t, locale } = useI18n();
  const languages = props.definition?.languages ?? [];
  const [language, setLanguage] = useState<string | undefined>(languages.includes(locale) ? locale : undefined);
  const form = useMemo<FormDefinition>(() => localizeForm({ fields: props.fields, ...(props.definition ?? {}) }, language), [props.fields, props.definition, language]);
  const [answers, setAnswersState] = useState<Record<string, unknown>>(props.initialAnswers ?? {});
  const [how, setHowState] = useState<Record<string, HowVerified>>(props.initialHow ?? {});
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [tried, setTried] = useState(false);
  const [fileNames, setFileNames] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [carriedLeft, setCarriedLeft] = useState<ReadonlySet<string>>(new Set(props.carried ?? []));

  const setAnswers = useCallback((next: Record<string, unknown>, nextHow: Record<string, HowVerified>) => {
    setAnswersState(next); setHowState(nextHow); setMessage(null);
    props.onChange?.(next, nextHow);
  }, [props]);

  const checked = useMemo(() => validateSubmission(form, answers, { how }), [form, answers, how]);
  const sentenceOf = useCallback((p: (typeof checked.problems)[number]) => (p.code && p.code !== "CONSTRAINT" ? t(`problem.${p.code}`, p.params) : p.message), [t]);
  const byPath = useMemo(() => problemsByPath(checked.problems, sentenceOf), [checked.problems, sentenceOf]);
  const sections = useMemo(() => sectionsOf(form, answers, t("assess.section.general")), [form, answers, t]);
  const current = Math.min(index, sections.length - 1);
  const progress = useMemo(() => sections.map((s) => sectionProgress(s, answers, byPath)), [sections, answers, byPath]);

  const ctx: FillContext = useMemo(() => ({
    t, uploadFile: props.uploadFile, placeNames: props.placeNames, fileNames, rememberFile: (id, n) => setFileNames((f) => ({ ...f, [id]: n })),
    locate: () => new Promise((resolve) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) { resolve({ ok: false, message: t("form.gpsUnsupported") }); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ ok: true, lat: String(Math.round(pos.coords.latitude * 1e6) / 1e6), lon: String(Math.round(pos.coords.longitude * 1e6) / 1e6) }),
        (err) => resolve({ ok: false, message: err.code === 1 ? t("form.gpsDenied") : t("form.gpsNone") }),
        { enableHighAccuracy: true, timeout: 20_000, maximumAge: 30_000 },
      );
    }),
    problemAt: (path) => (tried ? byPath.get(path) : undefined), language, how,
    setHow: (key, mode) => setAnswers(answers, mode ? { ...how, [key]: mode } : Object.fromEntries(Object.entries(how).filter(([k]) => k !== key))),
    readOnly: props.readOnly === true,
  }), [t, props.uploadFile, props.placeNames, props.readOnly, fileNames, tried, byPath, language, how, answers, setAnswers]);

  const change = (field: FormField, value: unknown) => {
    const next = { ...answers };
    if (value === undefined) delete next[field.key]; else next[field.key] = value;
    setCarriedLeft((c) => { const n = new Set(c); n.delete(field.key); return n; });
    setAnswers(next, how);
  };

  async function send() {
    setTried(true);
    if (checked.problems.length > 0) {
      const at = sections.findIndex((_, i) => progress[i]!.problems > 0);
      if (at >= 0) setIndex(at);
      return;
    }
    setSending(true);
    try {
      const outcome = await props.onSubmit(answers, { ...(props.withName ? { submitterName: name.trim() || undefined } : {}), how: checked.how } as never);
      if (outcome.ok) { setAnswersState({}); setHowState({}); setFileNames({}); setTried(false); setIndex(0); setMessage({ tone: "ok", text: t("form.sent") }); }
      else setMessage({ tone: "error", text: outcome.message });
    } finally { setSending(false); }
  }

  const section = sections[current];
  const several = sections.length > 1;
  const formWide = tried ? formLevelProblems(checked.problems) : [];
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void send(); }} {...(language && ["ar", "ur", "ps"].includes(language) ? { dir: "rtl" as const } : {})}>
      {props.status}
      {languages.length > 0 && (
        <Field label={t("assess.language")}>
          <Select value={language ?? ""} onChange={(e) => setLanguage(e.target.value || undefined)}>
            <option value="">{t("assess.language.default")}</option>
            {languages.map((l) => <option key={l} value={l}>{l}</option>)}
          </Select>
        </Field>
      )}
      {props.withName && <Field label={t("form.nameLabel")} description={t("form.nameHelp")}><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></Field>}
      <div className={several || form.score ? "grid gap-4 lg:grid-cols-[260px_1fr]" : ""}>
        {(several || form.score) && (
          <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
            {several && <SectionNav sections={sections} progress={progress} current={current} onPick={setIndex} t={t} />}
            {form.score && <ScorePanel rules={form.score} values={checked.values} t={t} />}
          </div>
        )}
        <div className="min-w-0 space-y-4">
          {(several ? [section] : sections).map((s) => s && (
            <section key={s.key} aria-label={s.title} className="space-y-4">
              {several && <h3 className="text-lg font-semibold">{s.title}</h3>}
              {s.intro && <p className="text-sm text-slate-600 dark:text-slate-300">{s.intro}</p>}
              {s.fields.map((f) => {
                if (f.type === "NOTE") return <p key={f.key} className="rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-800">{f.label}</p>;
                const View = FIELD_VIEWS[f.type];
                if (!View) return null;
                const props2: FieldViewProps = { field: f, value: answers[f.key], onChange: (v) => change(f, v), prefix: "", ctx, scope: answers };
                return (
                  <div key={f.key}>
                    {carriedLeft.has(f.key) && <p className="mb-1 text-xs text-amber-700 dark:text-amber-300">{t("assess.carried")}</p>}
                    <View {...props2} />
                  </div>
                );
              })}
            </section>
          ))}
          {several && (
            <div className="flex justify-between gap-2">
              <Button type="button" variant="secondary" disabled={current === 0} onClick={() => setIndex(current - 1)}>{t("assess.section.back")}</Button>
              {current < sections.length - 1 && <Button type="button" variant="secondary" onClick={() => setIndex(current + 1)}>{t("assess.section.next")}</Button>}
            </div>
          )}
        </div>
      </div>
      {formWide.length > 0 && <ul role="alert" className="list-disc space-y-1 ps-5 text-sm text-danger-600">{formWide.map((p, i) => <li key={i}>{sentenceOf(p)}</li>)}</ul>}
      {tried && checked.problems.length > 0 && <p role="alert" className="text-sm text-danger-600">{t("assess.problems.count", { count: checked.problems.length })}</p>}
      {(props.placeNames?.length ?? 0) > 0 && <datalist id="place-suggestions">{props.placeNames!.map((n) => <option key={n} value={n} />)}</datalist>}
      {message && <p role="status" className={`text-sm ${message.tone === "ok" ? "text-emerald-700 dark:text-emerald-300" : "text-danger-600"}`}>{message.text}</p>}
      {!props.readOnly && <Button type="submit" pending={sending} disabled={sending}>{props.submitLabel ?? t("form.send")}</Button>}
    </form>
  );
}
