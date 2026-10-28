"use client";

import { useMemo, useState } from "react";
import { validateSubmission, visibleFields, type FormField } from "@donordesk/domain/contexts/collection/index.js";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

export type FillOutcome = { ok: true } | { ok: false; message: string };

/**
 * One form, filled in. It asks the same rules the server enforces (`visibleFields`, `validateSubmission`), so a question appears
 * and disappears as the answers change and a problem is shown beside its question before anything is sent. The server still checks.
 */
export function FormFiller({ fields, onSubmit, uploadFile, placeNames, submitLabel = "Send", withName = false }: {
  fields: ReadonlyArray<FormField>;
  onSubmit: (answers: Record<string, unknown>, submitterName?: string) => Promise<FillOutcome>;
  /** Sends a photo or document and returns the id to keep as the answer; without it a file question cannot be answered. */
  uploadFile?: (file: File, fieldKey: string) => Promise<{ ok: true; id: string; name: string } | { ok: false; message: string }>;
  /** Names to suggest for place questions (from the offline pack); typing is never limited to them. */
  placeNames?: ReadonlyArray<string>;
  submitLabel?: string;
  /** Ask who is answering (the public link). */
  withName?: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [tried, setTried] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [locating, setLocating] = useState<string | null>(null);
  const [gpsErrors, setGpsErrors] = useState<Record<string, string>>({});

  /** Reads the phone's position. The satellite fix needs no connection, so this works offline. */
  function locate(key: string) {
    if (typeof navigator === "undefined" || !navigator.geolocation) { setGpsErrors((e) => ({ ...e, [key]: "This device cannot give its location." })); return; }
    setLocating(key);
    setGpsErrors((e) => ({ ...e, [key]: "" }));
    navigator.geolocation.getCurrentPosition(
      (pos) => { setAnswers((a) => ({ ...a, [key]: { lat: String(Math.round(pos.coords.latitude * 1e6) / 1e6), lon: String(Math.round(pos.coords.longitude * 1e6) / 1e6) } })); setLocating(null); },
      (err) => { setGpsErrors((e) => ({ ...e, [key]: err.code === 1 ? "Location is switched off for this page. Type the numbers instead." : "No position yet. Try outdoors, or type the numbers." })); setLocating(null); },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 30_000 },
    );
  }
  const [fileNames, setFileNames] = useState<Record<string, string>>({});
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});

  async function attach(key: string, file: File | undefined) {
    if (!file || !uploadFile) return;
    setUploading(key);
    setFileErrors((e) => ({ ...e, [key]: "" }));
    try {
      const r = await uploadFile(file, key);
      if (r.ok) { setAnswers((a) => ({ ...a, [key]: r.id })); setFileNames((n) => ({ ...n, [key]: r.name })); }
      else setFileErrors((e) => ({ ...e, [key]: r.message }));
    } finally { setUploading(null); }
  }
  const form = useMemo(() => ({ fields }), [fields]);
  const shown = visibleFields(form, answers);
  const problems = useMemo(() => {
    const byField = new Map<string, string>();
    for (const p of validateSubmission(form, answers).problems) byField.set(p.field, p.message);
    return byField;
  }, [form, answers]);

  const set = (key: string, value: unknown) => { setAnswers((a) => ({ ...a, [key]: value })); setMessage(null); };

  async function send() {
    setTried(true);
    if (problems.size > 0) return;
    setSending(true);
    try {
      const outcome = await onSubmit(answers, withName ? name.trim() || undefined : undefined);
      if (outcome.ok) {
        setAnswers({}); setFileNames({}); setTried(false); setMessage({ tone: "ok", text: "Sent. Thank you." });
      } else setMessage({ tone: "error", text: outcome.message });
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void send(); }}>
      {withName && (
        <Field label="Your name (optional)" description="So the team knows who sent this.">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </Field>
      )}
      {shown.map((f) => {
        const error = (tried ? problems.get(f.key) : undefined) || fileErrors[f.key] || gpsErrors[f.key] || undefined;
        const value = answers[f.key];
        const label = f.required ? f.label : `${f.label} (optional)`;
        return (
          <Field key={f.key} label={label} error={error}>
            {f.type === "NUMBER" ? (
              <Input inputMode="decimal" value={String(value ?? "")} onChange={(e) => set(f.key, e.target.value)} />
            ) : f.type === "DATE" ? (
              <Input type="date" value={String(value ?? "")} onChange={(e) => set(f.key, e.target.value)} />
            ) : f.type === "SELECT" ? (
              <Select value={String(value ?? "")} onChange={(e) => set(f.key, e.target.value)}>
                <option value="">Choose…</option>
                {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            ) : f.type === "YES_NO" ? (
              <Select value={String(value ?? "")} onChange={(e) => set(f.key, e.target.value)}>
                <option value="">Choose…</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </Select>
            ) : f.type === "FILE" ? (
              <div>
                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={!uploadFile || uploading === f.key} onChange={(e) => void attach(f.key, e.target.files?.[0])} />
                {uploading === f.key && <p className="mt-1 text-xs text-slate-500">Sending…</p>}
                {answers[f.key] !== undefined && fileNames[f.key] && <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Attached: {fileNames[f.key]}</p>}
                <p className="mt-1 text-xs text-slate-500">A photo (JPEG, PNG, WebP) or a PDF, up to 5 MB.</p>
              </div>
            ) : f.type === "GPS" ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2"><Button type="button" variant="secondary" onClick={() => locate(f.key)} pending={locating === f.key}>Use my location</Button></div>
                <Input aria-label={`${f.label}, latitude`} placeholder="Latitude" inputMode="decimal" value={String((value as { lat?: unknown } | undefined)?.lat ?? "")} onChange={(e) => set(f.key, { ...(value as object | undefined), lat: e.target.value })} />
                <Input aria-label={`${f.label}, longitude`} placeholder="Longitude" inputMode="decimal" value={String((value as { lon?: unknown } | undefined)?.lon ?? "")} onChange={(e) => set(f.key, { ...(value as object | undefined), lon: e.target.value })} />
              </div>
            ) : f.type === "PLACE" && placeNames && placeNames.length > 0 ? (
              <Input list="place-suggestions" value={String(value ?? "")} onChange={(e) => set(f.key, e.target.value)} autoComplete="off" />
            ) : f.maxLength && f.maxLength > 200 ? (
              <Textarea rows={3} value={String(value ?? "")} onChange={(e) => set(f.key, e.target.value)} />
            ) : (
              <Input value={String(value ?? "")} onChange={(e) => set(f.key, e.target.value)} />
            )}
          </Field>
        );
      })}
      {placeNames && placeNames.length > 0 && <datalist id="place-suggestions">{placeNames.map((n) => <option key={n} value={n} />)}</datalist>}
      {message && <p role="status" className={`text-sm ${message.tone === "ok" ? "text-emerald-700 dark:text-emerald-300" : "text-danger-600"}`}>{message.text}</p>}
      <Button type="submit" pending={sending} disabled={sending}>{submitLabel}</Button>
    </form>
  );
}
