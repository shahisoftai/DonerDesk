"use client";

import type { ReactNode } from "react";
import type { RecordKindKey } from "../domain/record-kinds";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { useRecordSheet } from "./RecordHost";

/**
 * A button that opens the Record sheet where it is wanted: on a project (its header), on an indicator, on a row that needs a value.
 * It only asks the host to open; what is recorded and how it is saved is the sheet's business. Without a host it does nothing.
 */
export function RecordButton({
  projectId, kind, indicatorId, plannedActivityId, className = "btn-primary", children,
}: {
  projectId?: string | undefined;
  kind?: RecordKindKey | undefined;
  indicatorId?: string | undefined;
  plannedActivityId?: string | undefined;
  className?: string;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const record = useRecordSheet();
  return (
    <button type="button" className={`${className} min-h-11`} onClick={() => record.open({ projectId, kind, indicatorId, plannedActivityId })}>
      {children ?? t("record.button")}
    </button>
  );
}
