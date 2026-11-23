"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormDefinition, FormField } from "@donordesk/domain/contexts/collection/index.js";
import { getAssessmentPrefillAction, moveFacilityAssignmentAction } from "@/lib/actions/assessments";
import { downloadOfflinePackAction } from "@/lib/actions/offline";
import { submitCollectionRecordAction } from "@/lib/actions/collection";
import type { OfflinePack } from "@/features/offline/domain/offline-pack";
import { newIdempotencyKey } from "@/lib/shared/create-retry";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { createServerDraftStore } from "../adapters/server-draft-store";
import { AssessmentFlow } from "./AssessmentFlow";
import { mustChooseFromAssigned } from "../domain/assessment-flow";
import type { FillFile } from "./filler/FormFiller";

/** Filling an assessment on the website: the facilities come from the project's pack, drafts are kept on the server and follow the person. */
export function OnlineAssessmentFill({ form, uploadFile, canManage = true, initialPlaceId }: {
  form: { id: string; projectId: string; name: string; fields: ReadonlyArray<FormField>; definition: Omit<FormDefinition, "fields"> };
  uploadFile: FillFile;
  /** A person who manages or reviews the form chooses from every facility; anyone else from the ones given to them. */
  canManage?: boolean;
  initialPlaceId?: string | undefined;
}) {
  const { t } = useI18n();
  const [pack, setPack] = useState<OfflinePack | "failed" | null>(null);
  const [moved, setMoved] = useState(0);
  const key = useRef(newIdempotencyKey());
  const drafts = useMemo(() => createServerDraftStore(), []);
  useEffect(() => {
    let live = true;
    void downloadOfflinePackAction(form.projectId, form.name).then((r) => { if (live) setPack(r.ok ? r.value : "failed"); });
    return () => { live = false; };
  }, [form.projectId, form.name, moved]);

  if (pack === null) return <p className="text-sm text-slate-500">{t("common.loading")}</p>;
  if (pack === "failed") return <p role="alert" className="text-sm text-danger-600">{t("assess.facility.loadFailed")}</p>;
  const mine = (pack.assignments ?? []).filter((a) => a.formId === form.id);
  return (
    <AssessmentFlow
      form={form}
      places={pack.places}
      assignments={mine}
      onlyAssigned={mustChooseFromAssigned(canManage, mine)}
      initialPlaceId={initialPlaceId}
      drafts={drafts}
      online
      rememberKey={`${form.projectId}:${form.id}`}
      uploadFile={uploadFile}
      prefill={async (placeId) => { const r = await getAssessmentPrefillAction(form.id, placeId); return r.ok ? { values: r.value.values, carried: r.value.carried } : null; }}
      onNotVisited={async (placeId, reason) => {
        const a = mine.find((x) => x.placeId === placeId);
        if (!a) return { ok: false, message: t("assess.facility.notAssigned") };
        const r = await moveFacilityAssignmentAction(a.id, { status: "NOT_VISITED", reason });
        if (!r.ok) return { ok: false, message: r.error.message };
        setMoved((n) => n + 1);
        return { ok: true };
      }}
      onSubmit={async ({ placeId, answers, how, startedAt }) => {
        // The same key is reused if the send is repeated, so a retry after a bad connection is stored once.
        const id = key.current.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60).padEnd(8, "0");
        const r = await submitCollectionRecordAction(form.id, { id, answers, ...(placeId ? { placeId } : {}), ...(Object.keys(how).length ? { how } : {}), startedAt });
        if (!r.ok) return { ok: false, message: r.error.message };
        key.current = newIdempotencyKey();
        setMoved((n) => n + 1);
        return { ok: true };
      }}
    />
  );
}
