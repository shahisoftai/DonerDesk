"use client";

import { useMemo, useRef } from "react";
import { newIdempotencyKey } from "@/lib/shared/create-retry";
import { AssessmentFlow } from "@/features/collection/presentation/AssessmentFlow";
import { deviceDraftStore } from "@/features/collection/adapters/indexeddb-draft-store";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { collectionRecordEntry, type QueuedAttachment } from "../../domain/collection-outbox";
import type { OfflinePack } from "../../domain/offline-pack";
import { useOutbox } from "../OutboxProvider";

/**
 * Fills a form and puts the finished one in the outbox; the outbox sends it now if online, or whenever the connection returns. A form about a
 * facility starts from the facilities given to this person in the downloaded work (and opens the one they chose), keeps a draft on the phone
 * while filling (photos included) and carries forward what the last visit knew. A photo or signature stays on the phone with the record and goes up with it.
 */
export function FormScreen({ pack, formId, placeId, onBack, onDone }: { pack: OfflinePack; formId: string; placeId?: string | undefined; onBack: () => void; onDone: (sentNow: boolean) => void }) {
  const outbox = useOutbox();
  const { t } = useI18n();
  const form = pack.forms.find((f) => f.id === formId);
  // Files taken so far, by the placeholder id the answers hold. Kept in a ref: the draft saves a snapshot, a send reads the ones still named.
  const taken = useRef<Record<string, QueuedAttachment & { placeholder: string }>>({});
  const drafts = useMemo(() => deviceDraftStore(pack.userId), [pack.userId]);
  const definition = useMemo(() => ({
    ...(form?.constraints ? { constraints: form.constraints } : {}), ...(form?.subject ? { subject: form.subject } : {}), ...(form?.score ? { score: form.score } : {}), ...(form?.languages ? { languages: form.languages } : {}),
  }), [form]);
  const assignments = (pack.assignments ?? []).filter((a) => a.formId === formId);
  if (!form) return null;

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex min-h-12 items-center rounded-xl px-2 text-lg font-semibold text-brand-700 dark:text-brand-300">{t("fa.back")}</button>
      <h1 className="break-words text-2xl font-bold">{form.name}</h1>
      <AssessmentFlow
        form={{ id: formId, name: form.name, fields: form.fields, definition }}
        places={pack.places}
        assignments={assignments}
        onlyAssigned={assignments.length > 0}
        initialPlaceId={placeId}
        drafts={drafts}
        online={outbox.online}
        rememberKey={`${pack.projectId}:${formId}`}
        submitLabel={outbox.online ? t("common.send") : t("common.saveOnPhone")}
        prefill={async (id) => {
          const hit = (pack.prefill ?? []).find((p) => p.formId === formId && p.placeId === id);
          return hit ? { values: hit.values, carried: Object.keys(hit.values) } : null;
        }}
        files={{
          snapshot: () => Object.fromEntries(Object.entries(taken.current).map(([id, f]) => [id, { name: f.name, type: f.type, blob: f.blob }])),
          restore: (saved) => { taken.current = Object.fromEntries(Object.entries(saved).map(([id, f]) => [id, { fieldKey: id, placeholder: id, name: f.name, type: f.type, blob: f.blob }])); },
        }}
        uploadFile={async (file, fieldKey) => {
          if (file.size > 5 * 1024 * 1024) return { ok: false, message: t("form.fileTooBig") };
          const token = newIdempotencyKey().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24).padEnd(8, "0");
          taken.current = { ...taken.current, [token]: { fieldKey, placeholder: token, name: file.name, type: file.type, blob: file } };
          return { ok: true, id: token, name: file.name };
        }}
        onSubmit={async ({ placeId: chosen, answers, how, startedAt }) => {
          if (!outbox.supported) return { ok: false, message: t("fa.get.cannotKeep") };
          // Only the files the finished answers still name go up; the placeholders are replaced by the real ids when they are sent.
          const text = JSON.stringify(answers);
          const attached = Object.values(taken.current).filter((f) => text.includes(`"${f.placeholder}"`));
          const id = newIdempotencyKey().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60).padEnd(8, "0");
          await outbox.enqueue(collectionRecordEntry({
            id, title: form.name, now: Date.now(),
            payload: { formId, answers, files: attached, ...(chosen ? { placeId: chosen } : {}), ...(Object.keys(how).length ? { how } : {}), startedAt },
          }));
          taken.current = {};
          void outbox.sendNow();
          queueMicrotask(() => onDone(outbox.online));
          return { ok: true };
        }}
      />
    </div>
  );
}
