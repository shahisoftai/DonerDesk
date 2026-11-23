"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { framed } from "../FieldFrame";
import type { FieldViewProps } from "../field-types";

const text = (v: unknown): string => (v === undefined || v === null ? "" : String(v));
const dirFor = (language: string | undefined): "rtl" | undefined => (language && ["ar", "ur", "ps", "fa", "he"].includes(language) ? "rtl" : undefined);

export function NumberFieldView(p: FieldViewProps) {
  return framed(p, <Input inputMode="decimal" value={text(p.value)} disabled={p.ctx.readOnly} onChange={(e) => p.onChange(e.target.value)} />);
}

export function DateFieldView(p: FieldViewProps) {
  return framed(p, <Input type="date" value={text(p.value)} disabled={p.ctx.readOnly} onChange={(e) => p.onChange(e.target.value)} />);
}

export function TextFieldView(p: FieldViewProps) {
  const long = (p.field.maxLength ?? 0) > 200;
  const dir = dirFor(p.ctx.language);
  return framed(p, long
    ? <Textarea rows={3} value={text(p.value)} disabled={p.ctx.readOnly} {...(dir ? { dir } : {})} onChange={(e) => p.onChange(e.target.value)} />
    : <Input value={text(p.value)} disabled={p.ctx.readOnly} {...(dir ? { dir } : {})} onChange={(e) => p.onChange(e.target.value)} />);
}

export function PlaceFieldView(p: FieldViewProps) {
  const listed = (p.ctx.placeNames?.length ?? 0) > 0;
  return framed(p, <Input {...(listed ? { list: "place-suggestions" } : {})} value={text(p.value)} disabled={p.ctx.readOnly} autoComplete="off" onChange={(e) => p.onChange(e.target.value)} />);
}

export function SelectFieldView(p: FieldViewProps) {
  return framed(p, (
    <Select value={text(p.value)} disabled={p.ctx.readOnly} onChange={(e) => p.onChange(e.target.value)}>
      <option value="">{p.ctx.t("common.choose")}</option>
      {(p.field.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </Select>
  ));
}

export function YesNoFieldView(p: FieldViewProps) {
  const value = typeof p.value === "boolean" ? (p.value ? "yes" : "no") : text(p.value);
  return framed(p, (
    <Select value={value} disabled={p.ctx.readOnly} onChange={(e) => p.onChange(e.target.value)}>
      <option value="">{p.ctx.t("common.choose")}</option>
      <option value="yes">{p.ctx.t("common.yes")}</option>
      <option value="no">{p.ctx.t("common.no")}</option>
    </Select>
  ));
}

export function GpsFieldView(p: FieldViewProps) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const g = (p.value ?? {}) as { lat?: unknown; lon?: unknown };
  const { t } = p.ctx;
  async function locate() {
    setBusy(true); setNote("");
    const r = await p.ctx.locate();
    setBusy(false);
    if (r.ok) p.onChange({ lat: r.lat, lon: r.lon }); else setNote(r.message);
  }
  return framed(p, (
    <div className="grid grid-cols-2 gap-2">
      <div className="col-span-2"><Button type="button" variant="secondary" disabled={p.ctx.readOnly} onClick={() => void locate()} pending={busy}>{t("form.useLocation")}</Button></div>
      <Input aria-label={`${p.field.label}, ${t("form.latitude")}`} placeholder={t("form.latitude")} inputMode="decimal" value={text(g.lat)} disabled={p.ctx.readOnly} onChange={(e) => p.onChange({ ...g, lat: e.target.value })} />
      <Input aria-label={`${p.field.label}, ${t("form.longitude")}`} placeholder={t("form.longitude")} inputMode="decimal" value={text(g.lon)} disabled={p.ctx.readOnly} onChange={(e) => p.onChange({ ...g, lon: e.target.value })} />
      {note && <p role="status" className="col-span-2 text-sm text-danger-600">{note}</p>}
    </div>
  ));
}

export function FileFieldView(p: FieldViewProps) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const { t, uploadFile } = p.ctx;
  async function attach(file: File | undefined) {
    if (!file || !uploadFile) return;
    setBusy(true); setNote("");
    try {
      const r = await uploadFile(file, p.field.key);
      if (r.ok) { p.ctx.rememberFile(r.id, r.name); p.onChange(r.id); } else setNote(r.message);
    } finally { setBusy(false); }
  }
  const id = text(p.value);
  return framed(p, (
    <div>
      <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={!uploadFile || busy || p.ctx.readOnly} onChange={(e) => void attach(e.target.files?.[0])} />
      {busy && <p className="mt-1 text-xs text-slate-500">{t("form.sending")}</p>}
      {id && p.ctx.fileNames[id] && <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{t("form.attached", { name: p.ctx.fileNames[id] ?? "" })}</p>}
      {note && <p role="status" className="mt-1 text-xs text-danger-600">{note}</p>}
      <p className="mt-1 text-xs text-slate-500">{t("form.fileHelp")}</p>
    </div>
  ));
}
