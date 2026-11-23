"use client";

import { useState } from "react";
import { usePackRecordDeps } from "@/features/record/composition";
import { RecordSheetBody } from "@/features/record/presentation/RecordSheetBody";
import type { RecordKind } from "@/features/record/domain/record-kinds";
import type { Capability } from "@/lib/shared/capabilities";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import type { OfflinePack } from "../../domain/offline-pack";

/** A pack is only made for someone who may record; activities are offered, and the server still checks each record on send. */
const PACK_CAPABILITIES: readonly Capability[] = ["indicator.update", "activity.create"];
/** With no signal only what works from the phone is offered; forms have their own cards. */
const OFFLINE_KINDS = (kind: RecordKind) => kind.offline !== "ONLINE_ONLY" && kind.key !== "FORM";

/** "Something we did": the same Record screen as the signed-in app, fed from the downloaded work, with a way back to Today. */
export function RecordScreen({ packs, plannedActivityId, projectId, onBack }: { packs: OfflinePack[]; plannedActivityId?: string | undefined; projectId?: string | undefined; onBack: () => void }) {
  const deps = usePackRecordDeps(packs);
  const { t } = useI18n();
  const [session, setSession] = useState(0);
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex min-h-12 items-center rounded-xl px-2 text-lg font-semibold text-brand-700 dark:text-brand-300">{t("fa.back")}</button>
      <section className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900" aria-label={t("record.sheet.title")}>
        <h1 className="mb-3 text-2xl font-bold">{t("record.kind.ACTIVITY")}</h1>
        <RecordSheetBody key={session} deps={deps} capabilities={PACK_CAPABILITIES} request={{ kind: "ACTIVITY", projectId, plannedActivityId }} kindFilter={OFFLINE_KINDS} onClose={() => { setSession((n) => n + 1); onBack(); }} />
      </section>
    </div>
  );
}
