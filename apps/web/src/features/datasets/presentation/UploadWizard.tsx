"use client";

import { useState } from "react";
import type { ColumnDef, TidyStep } from "@donordesk/domain/contexts/datasets/browser.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { addDatasetVersionAction, checkDatasetUploadAction, saveDatasetAction } from "@/lib/actions/datasets";
import { WIZARD_STEPS, withSource, type WizardStep } from "../domain/wizard";
import type { CheckResult, KitView, UploadPreview } from "../domain/types";
import { UploadStep } from "./UploadStep";
import { TableStep } from "./TableStep";
import { ColumnsStep } from "./ColumnsStep";
import { PlacesStep } from "./PlacesStep";
import { TidyPanel } from "./TidyPanel";
import { CheckStep } from "./CheckStep";
import { DoneStep } from "./DoneStep";

export interface WizardProps {
  projects: Array<{ id: string; title: string; country?: string | undefined }>;
  kits: KitView[];
  projectId?: string | undefined;
  canCreateOrg: boolean;
  /** Adding a new upload to an existing dataset (J2): its steps and columns are replayed on the server. */
  refresh?: { datasetId: string; name: string } | undefined;
}

/**
 * Bring in a table (Phase 54, §4.2): upload, choose the table, confirm columns, fix places, tidy (optional), check, done. One decision a
 * screen. The server reads the file again at every step with the person's choices, so what the check screen shows is exactly what is saved.
 */
export function UploadWizard({ projects, kits, projectId, canCreateOrg, refresh }: WizardProps) {
  const { t } = useI18n();
  const [stage, setStage] = useState<WizardStep>("UPLOAD");
  const [upload, setUpload] = useState<UploadPreview | null>(null);
  const [steps, setSteps] = useState<TidyStep[]>([]);
  const [columns, setColumns] = useState<ColumnDef[] | undefined>(undefined);
  const [kitKey, setKitKey] = useState<string | undefined>(undefined);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"REPLACE" | "ADD_PERIODS">("ADD_PERIODS");
  const [saved, setSaved] = useState<{ id: string; summary: string } | null>(null);
  const [project, setProject] = useState(projectId ?? projects[0]?.id ?? "");
  const country = projects.find((p) => p.id === project)?.country;

  async function run(next: { steps?: TidyStep[]; columns?: ColumnDef[] | undefined; kitKey?: string | undefined }, go?: WizardStep): Promise<void> {
    if (!upload) return;
    const s = next.steps ?? steps, c = "columns" in next ? next.columns : columns, k = "kitKey" in next ? next.kitKey : kitKey;
    setBusy(true); setError(null);
    const r = await checkDatasetUploadAction({ fileKey: upload.fileKey, steps: s, ...(c?.length ? { columns: c } : {}), ...(k ? { kitKey: k } : {}), ...(refresh ? { datasetId: refresh.datasetId, mode } : {}), ...(country ? { projectCountry: country } : {}) });
    setBusy(false);
    if (!r.ok) { setError(r.error.message); return; }
    setSteps(s); setKitKey(k); setCheck(r.value); setColumns(r.value.columns);
    if (r.value.problem) { setError(r.value.problem); return; }
    if (go) setStage(go);
  }

  async function save(meta: { name: string; description: string; scope: "PROJECT" | "ORGANISATION" }): Promise<void> {
    if (!upload || !check) return;
    setBusy(true); setError(null);
    const r = refresh
      ? await addDatasetVersionAction(refresh.datasetId, { fileKey: upload.fileKey, fileName: upload.fileName, mode, ...(country ? { projectCountry: country } : {}) })
      : await saveDatasetAction({ name: meta.name, description: meta.description, scope: meta.scope, ...(meta.scope === "PROJECT" ? { projectId: project } : {}), fileKey: upload.fileKey, fileName: upload.fileName, steps, columns: check.columns, ...(kitKey ? { kitKey, kitMapping: check.kit?.mapping ?? {} } : {}), ...(country ? { projectCountry: country } : {}) });
    setBusy(false);
    if (!r.ok) { setError(r.error.message); return; }
    setSaved({ id: refresh ? refresh.datasetId : (r.value as { id: string }).id, summary: r.value.summary });
    setStage("DONE");
  }

  const at = WIZARD_STEPS.indexOf(stage);
  const shown = refresh ? WIZARD_STEPS.filter((s) => s !== "COLUMNS" && s !== "TIDY") : WIZARD_STEPS;
  return (
    <div className="space-y-4" data-testid="dataset-wizard">
      <ol className="flex flex-wrap gap-2 text-xs" aria-label={t("ds.wizard.progress")}>
        {shown.map((s) => <li key={s} aria-current={s === stage ? "step" : undefined} className={`rounded-full px-2 py-0.5 ${s === stage ? "bg-brand-700 text-white" : WIZARD_STEPS.indexOf(s) < at ? "bg-brand-50 text-brand-900 dark:bg-brand-950 dark:text-brand-100" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>{t(`ds.step.${s}`)}</li>)}
      </ol>
      {refresh && <p className="text-sm">{t("ds.wizard.refreshing", { name: refresh.name })}</p>}
      {error && <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-100">{error}</p>}
      {busy && <p role="status" className="text-sm text-slate-500">{t("ds.wizard.reading")}</p>}
      {stage === "UPLOAD" && <UploadStep kits={kits} onUploaded={(u) => { setUpload(u); setSteps(withSource([], u.sheet, u.headerRow)); setStage("TABLE"); }} />}
      {stage === "TABLE" && upload && <TableStep upload={upload} onBack={() => setStage("UPLOAD")} onNext={(sheet, row) => void run({ steps: withSource(steps, sheet, row), columns: refresh ? undefined : undefined }, refresh ? "PLACES" : "COLUMNS")} />}
      {stage === "COLUMNS" && check && <ColumnsStep key={JSON.stringify(check.columns.map((c) => [c.key, c.label, c.kind, c.semantic]))} check={check} kits={kits} kitKey={kitKey} steps={steps} onBack={() => setStage("TABLE")} onApply={(next) => void run(next)} onNext={() => setStage("PLACES")} />}
      {stage === "PLACES" && check && <PlacesStep check={check} steps={steps} onApply={(s) => void run({ steps: s })} onBack={() => setStage(refresh ? "TABLE" : "COLUMNS")} onNext={() => setStage(refresh ? "CHECK" : "TIDY")} />}
      {stage === "TIDY" && check && <TidyPanel check={check} steps={steps} onApply={(s) => void run({ steps: s })} onBack={() => setStage("PLACES")} onNext={() => setStage("CHECK")} />}
      {stage === "CHECK" && check && upload && (
        <CheckStep check={check} upload={upload} steps={steps} refresh={Boolean(refresh)} mode={mode} onMode={(m) => { setMode(m); void run({}); }} projects={projects} project={project} onProject={setProject}
          canCreateOrg={canCreateOrg} busy={busy} onBack={() => setStage(refresh ? "PLACES" : "TIDY")} onSave={save} />
      )}
      {stage === "DONE" && saved && <DoneStep datasetId={saved.id} summary={saved.summary} kitKey={kitKey} kits={kits} refreshed={Boolean(refresh)} />}
    </div>
  );
}
