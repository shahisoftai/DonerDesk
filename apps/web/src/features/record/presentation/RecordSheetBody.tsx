"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Capability } from "@/lib/shared/capabilities";
import { Select } from "@/components/ui/Select";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import type { RecordDeps } from "../composition";
import { availableKinds, startingKind, type RecordKind, type RecordKindKey } from "../domain/record-kinds";
import { RECORD_PREFS_KEY, parseRecordPrefs, serializeRecordPrefs, startingProject } from "../domain/record-prefs";
import { localPlainDay } from "../domain/record-day";
import type { RecordProject } from "../ports/record-lookup";
import { KindChooser } from "./KindChooser";
import { KIND_VIEWS } from "./kind-views";

export interface RecordRequest {
  projectId?: string | undefined;
  kind?: RecordKindKey | undefined;
  indicatorId?: string | undefined;
  plannedActivityId?: string | undefined;
}

function readPrefs() {
  try { return parseRecordPrefs(window.localStorage.getItem(RECORD_PREFS_KEY)); } catch { return {}; }
}
function writePrefs(prefs: { projectId?: string | undefined; kind?: RecordKindKey | undefined }) {
  try { window.localStorage.setItem(RECORD_PREFS_KEY, serializeRecordPrefs(prefs)); } catch { /* remembered for this visit only */ }
}

/**
 * What is inside the Record sheet: which project, what to record, then the form. It reads through the lookup and writes through the
 * sink it is given, so it is the same on a desktop, on a phone and (later) on the offline field page.
 */
export function RecordSheetBody({ deps, capabilities, request, onClose, kindFilter }: { deps: RecordDeps; capabilities: readonly Capability[]; request: RecordRequest; onClose: () => void; /** Narrow the kinds offered (the offline page offers only what works with no signal). */ kindFilter?: ((kind: RecordKind) => boolean) | undefined }) {
  const { t } = useI18n();
  const [projects, setProjects] = useState<RecordProject[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [projectId, setProjectId] = useState<string | undefined>(request.projectId);
  const [kind, setKind] = useState<RecordKind | undefined>();
  const [hasForms, setHasForms] = useState(false);
  const prefs = useMemo(() => readPrefs(), []);
  const today = useMemo(() => localPlainDay(new Date()), []);
  const can = useCallback((c: Capability) => capabilities.includes(c), [capabilities]);
  const kinds = useMemo(() => availableKinds({ has: can, hasForms }).filter((k) => (kindFilter ? kindFilter(k) : true)), [can, hasForms, kindFilter]);

  useEffect(() => {
    let alive = true;
    setLoadFailed(false);
    deps.lookup.projects().then((list) => {
      if (!alive) return;
      setProjects(list);
      setProjectId((current) => current ?? startingProject(list, prefs.projectId));
    }).catch(() => alive && setLoadFailed(true));
    return () => { alive = false; };
  }, [deps.lookup, prefs.projectId]);

  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    deps.lookup.forms(projectId).then((f) => alive && setHasForms(f.length > 0)).catch(() => alive && setHasForms(false));
    return () => { alive = false; };
  }, [deps.lookup, projectId]);

  // A kind asked for by the opener, or the one used last, is opened without another tap only when the opener named it.
  const startedOn = useRef(false);
  useEffect(() => {
    if (startedOn.current || !request.kind) return;
    const first = startingKind(kinds, request.kind);
    if (first?.key !== request.kind) return;
    startedOn.current = true;
    setKind(first);
  }, [request.kind, kinds]);

  function choose(next: RecordKind) {
    setKind(next);
    if (projectId) writePrefs({ projectId, kind: next.key });
  }

  if (loadFailed) return <Notice text={t("record.sheet.loadFailed")} action={{ label: t("record.sheet.tryAgain"), onClick: () => deps.lookup.refresh(projectId ?? "") }} />;
  if (projects === null) return <p className="text-sm text-slate-600 dark:text-slate-300">{t("record.sheet.loading")}</p>;
  if (projects.length === 0) return <p className="text-sm text-slate-600 dark:text-slate-300">{t("record.sheet.noProjects")}</p>;

  const project = projects.find((p) => p.id === projectId);
  const projectPicker = projects.length > 1 || !project ? (
    <div className="mb-4 space-y-1">
      <label className="label" htmlFor="record-project">{t("record.sheet.project")}</label>
      <Select id="record-project" className="min-h-[52px] text-base" value={projectId ?? ""} onChange={(e) => { setProjectId(e.target.value || undefined); setKind(undefined); }}>
        {!project && <option value="">{t("common.choose")}</option>}
        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </Select>
    </div>
  ) : null;

  if (!project || !projectId) return projectPicker;
  if (kinds.length === 0) return <>{projectPicker}<p className="text-sm text-slate-600 dark:text-slate-300">{t("record.sheet.noKinds")}</p></>;

  if (!kind) {
    return <>{projectPicker}<h3 className="mb-1 text-xl font-bold">{t("record.sheet.chooseWhat")}</h3><KindChooser kinds={kinds} last={prefs.kind} onChoose={choose} /></>;
  }

  const back = <button type="button" className="mb-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 dark:text-brand-300" onClick={() => setKind(undefined)}>‹ {t("record.sheet.back")}</button>;

  const View = KIND_VIEWS[kind.key];
  return (
    <>
      {projectPicker}{back}
      <h3 className="mb-3 text-xl font-bold">{t(kind.labelKey)}</h3>
      <View deps={deps} kind={kind} projectId={projectId} today={today} can={can} indicatorId={request.indicatorId} plannedActivityId={request.plannedActivityId} onClose={onClose} />
    </>
  );
}

function Notice({ text, action }: { text: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="space-y-3">
      <p role="alert" className="text-sm text-slate-700 dark:text-slate-200">{text}</p>
      {action && <button type="button" className="btn-secondary min-h-[48px]" onClick={action.onClick}>{action.label}</button>}
    </div>
  );
}
