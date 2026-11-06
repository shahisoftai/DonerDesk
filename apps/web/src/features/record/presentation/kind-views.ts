import type { ComponentType } from "react";
import type { RecordKindKey } from "../domain/record-kinds";
import type { KindViewProps } from "./KindView";
import { ActivityEntryView } from "./ActivityEntryView";
import { NumberView } from "./NumberView";
import { pageLinkView } from "./PageLinkView";

/**
 * The view for each kind of record: the one place the sheet learns which form belongs to which kind. A new kind is a row in
 * `RECORD_KINDS`, a view here and a sender; the sheet itself never changes. The type makes a missing row a compile error.
 */
export const KIND_VIEWS: Readonly<Record<RecordKindKey, ComponentType<KindViewProps>>> = {
  NUMBER: NumberView,
  ACTIVITY: ActivityEntryView,
  FILE: pageLinkView((id) => `/projects/${id}/evidence/new`),
  EXPENSE: pageLinkView((id) => `/projects/${id}/finance`),
  FORM: pageLinkView(() => "/field"),
};
