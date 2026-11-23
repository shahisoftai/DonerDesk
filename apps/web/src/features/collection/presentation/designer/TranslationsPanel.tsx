"use client";

import { useState } from "react";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { Draft } from "../../domain/designer-model";

/** The wording of every question in one other language, side by side with the default; a blank cell falls back to the default wording. */
export function TranslationsPanel({ languages, fields, onChange }: { languages: string[]; fields: Draft[]; onChange(i: number, lang: string, label: string, help: string): void }) {
  const [lang, setLang] = useState(languages[0] ?? "");
  if (languages.length === 0) return null;
  const current = languages.includes(lang) ? lang : languages[0]!;
  const rows = fields.map((f, i) => ({ f, i })).filter(({ f }) => f.label.trim() !== "");
  const missing = rows.filter(({ f }) => !(f.original?.labels?.[current] ?? "").trim()).length;
  return (
    <details className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <summary className="cursor-pointer text-base font-semibold">Wording in other languages</summary>
      <div className="mt-3 space-y-3">
        <Field label="Language"><Select value={current} onChange={(e) => setLang(e.target.value)}>{languages.map((l) => <option key={l} value={l}>{l}</option>)}</Select></Field>
        <p className="text-xs text-slate-500">{missing === 0 ? "Every question has wording in this language." : `${missing} ${missing === 1 ? "question has" : "questions have"} no wording in this language yet; the default wording is used for them.`}</p>
        <ul className="max-h-[28rem] space-y-2 overflow-y-auto">
          {rows.map(({ f, i }) => (
            <li key={f.key} className="grid gap-2 sm:grid-cols-2">
              <p className="text-sm break-words text-slate-600 dark:text-slate-300">{f.label}</p>
              <Input dir={["ar", "ur", "ps", "fa", "he"].includes(current) ? "rtl" : undefined} aria-label={`${f.label} in ${current}`} value={f.original?.labels?.[current] ?? ""} onChange={(e) => onChange(i, current, e.target.value, f.original?.helpLabels?.[current] ?? "")} />
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
