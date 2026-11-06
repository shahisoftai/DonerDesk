"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { guideBoundaryFields, type FieldGuide } from "@donordesk/domain/contexts/identity/boundary-layer.js";
import { removeBoundaryLayerAction, uploadBoundaryLayerAction } from "@/lib/actions/org";
import { useActionState } from "@/lib/client/action-state";
import { loadBoundaryManifest } from "@/lib/client/boundary-loader";
import { resetBoundaryLayerCache } from "@/lib/client/tenant-boundary-layers";
import type { BoundaryLayerMeta } from "@/lib/server/schemas-boundary-layers";
import { Button } from "@/components/ui/Button";
import { useMapText } from "@/features/maps/presentation/useMapText";

const MB = 1024 * 1024;
const NONE = "";

/**
 * Boundary files for a country and a level (Phase 41.7): districts, sub-districts, wards or communities where no open file exists.
 * The file is read here first so the person sees what it holds and confirms which column is the name, the code and the parent's code;
 * the server checks it again and refuses it, naming the boundary, if any does not fit. Administrators only (the settings page gates this).
 */
export function BoundaryLayersCard({ layers }: { layers: readonly BoundaryLayerMeta[] }) {
  const router = useRouter();
  const { t, levelPlural } = useMapText();
  const upload = useActionState();
  const removal = useActionState();
  const form = useRef<HTMLFormElement>(null);
  const [countries, setCountries] = useState<Array<{ name: string; iso: string }>>([]);
  const [country, setCountry] = useState("");
  const [iso, setIso] = useState("");
  const [level, setLevel] = useState("4");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [guide, setGuide] = useState<FieldGuide | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [nameField, setNameField] = useState("");
  const [pcodeField, setPcodeField] = useState(NONE);
  const [parentField, setParentField] = useState(NONE);
  const busy = upload.busy || removal.busy;

  useEffect(() => { void loadBoundaryManifest().then((m) => setCountries((m?.countries ?? []).map((c) => ({ name: c.name, iso: c.iso })))); }, []);

  // Read the file in the browser, and again when the level changes (the parent column to suggest depends on it).
  useEffect(() => {
    if (!text) { setGuide(null); setProblem(null); return; }
    const out = guideBoundaryFields(text, Number(level));
    if (!out.ok) { setGuide(null); setProblem(out.error.message); return; }
    setProblem(null);
    setGuide(out.value);
    setNameField(out.value.suggested.nameField ?? "");
    setPcodeField(out.value.suggested.pcodeField ?? NONE);
    setParentField(out.value.suggested.parentPcodeField ?? NONE);
  }, [text, level]);

  function chooseCountry(value: string) {
    setCountry(value);
    const hit = countries.find((c) => c.name.toLowerCase() === value.trim().toLowerCase());
    if (hit) setIso(hit.iso);
  }

  async function choose(selected: File | undefined) {
    setFile(selected ?? null);
    setText(selected ? await selected.text() : "");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    const body = new FormData();
    body.set("iso", iso);
    body.set("countryName", country);
    body.set("adminLevel", level);
    body.set("nameField", nameField);
    if (pcodeField !== NONE) body.set("pcodeField", pcodeField);
    if (parentField !== NONE) body.set("parentPcodeField", parentField);
    body.set("file", file);
    const done = await upload.run(() => uploadBoundaryLayerAction(body));
    if (done) { resetBoundaryLayerCache(); form.current?.reset(); setFile(null); setText(""); router.refresh(); }
  }

  async function remove(layer: BoundaryLayerMeta) {
    const done = await removal.run(() => removeBoundaryLayerAction(layer.iso, layer.adminLevel));
    if (done) { resetBoundaryLayerCache(); router.refresh(); }
  }

  const ready = !!file && !!guide && nameField !== "" && /^[A-Za-z]{3}$/.test(iso) && country.trim() !== "";
  return (
    <div className="card" aria-labelledby="boundary-layers-title">
      <h3 id="boundary-layers-title" className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t("maps.boundary.title")}</h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t("maps.boundary.intro")}</p>
      {layers.length > 0 ? (
        <ul className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 text-sm dark:divide-white/10 dark:border-white/10">
          {layers.map((l) => (
            <li key={`${l.iso}-${l.adminLevel}`} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <span>
                <strong>{l.countryName}</strong> · {levelPlural(l.adminLevel)} · {l.name}
                <span className="block text-xs text-slate-500">{t("maps.boundary.meta", { count: l.featureCount, size: (l.sizeBytes / MB).toFixed(2), codes: l.hasCodes ? t("maps.boundary.withCodes") : t("maps.boundary.namesOnly") })}</span>
              </span>
              <button type="button" className="text-sm font-medium text-red-600 hover:underline dark:text-red-400" disabled={busy} aria-label={t("maps.boundary.removeAria", { level: levelPlural(l.adminLevel), country: l.countryName })} onClick={() => void remove(l)}>{t("maps.boundary.remove")}</button>
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{t("maps.boundary.none")}</p>}

      <form ref={form} onSubmit={submit} className="mt-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">{t("maps.boundary.country")}
            <input className="input block" aria-label={t("maps.boundary.country")} list="boundary-countries" value={country} onChange={(e) => chooseCountry(e.target.value)} disabled={busy} />
            <datalist id="boundary-countries">{countries.map((c) => <option key={c.iso} value={c.name} />)}</datalist>
          </label>
          <label className="text-sm">{t("maps.boundary.codeHint")}
            <input className="input block w-24 uppercase" aria-label={t("maps.boundary.countryCode")} maxLength={3} value={iso} onChange={(e) => setIso(e.target.value.toUpperCase())} disabled={busy} />
          </label>
          <label className="text-sm">{t("maps.boundary.level")}
            <select className="input block" aria-label={t("maps.boundary.level")} value={level} onChange={(e) => setLevel(e.target.value)} disabled={busy}>
              {[1, 2, 3, 4].map((l) => <option key={l} value={l}>{levelPlural(l)}</option>)}
            </select>
          </label>
        </div>
        <input type="file" accept=".json,.geojson,application/geo+json,application/json" aria-label={t("maps.boundary.file")} className="block w-full text-sm text-slate-700 dark:text-slate-200" disabled={busy} onChange={(e) => void choose(e.target.files?.[0])} />
        {problem && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{problem}</p>}
        {guide && (
          <div className="space-y-2 rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10" data-testid="boundary-guide">
            <p>{t("maps.boundary.found", { count: guide.featureCount })}</p>
            <div className="flex flex-wrap gap-3">
              <label>{t("maps.boundary.nameLabel")} <select className="input block" aria-label={t("maps.boundary.nameColumn")} value={nameField} onChange={(e) => setNameField(e.target.value)}>{guide.fields.map((f) => <option key={f} value={f}>{f}</option>)}</select></label>
              <label>{t("maps.boundary.codeLabel")} <select className="input block" aria-label={t("maps.boundary.codeColumn")} value={pcodeField} onChange={(e) => setPcodeField(e.target.value)}><option value={NONE}>{t("maps.boundary.noCode")}</option>{guide.fields.map((f) => <option key={f} value={f}>{f}</option>)}</select></label>
              <label>{t("maps.boundary.parentLabel")} <select className="input block" aria-label={t("maps.boundary.parentColumn")} value={parentField} onChange={(e) => setParentField(e.target.value)}><option value={NONE}>{t("maps.boundary.noParent")}</option>{guide.fields.map((f) => <option key={f} value={f}>{f}</option>)}</select></label>
            </div>
            <p className="text-xs text-slate-500">{nameField ? (pcodeField !== NONE ? t("maps.boundary.firstCode", { name: guide.sample[0]?.[nameField] ?? "", code: guide.sample[0]?.[pcodeField] ?? "" }) : t("maps.boundary.first", { name: guide.sample[0]?.[nameField] ?? "" })) : t("maps.boundary.chooseName")}</p>
          </div>
        )}
        <Button type="submit" disabled={busy || !ready}>{upload.busy ? t("maps.boundary.uploading") : t("maps.boundary.upload")}</Button>
      </form>
      {(upload.error ?? removal.error) && <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{upload.error ?? removal.error}</p>}
    </div>
  );
}
