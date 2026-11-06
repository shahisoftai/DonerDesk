"use client";

import type { KindViewProps } from "./KindView";
import { ActivityView } from "./ActivityView";
import { WorkOutcomeView } from "./WorkOutcomeView";

/** The activity kind's view: from a planned item it first asks what happened; otherwise it is the plain activity form. */
export function ActivityEntryView(props: KindViewProps) {
  return props.plannedActivityId ? <WorkOutcomeView {...props} plannedActivityId={props.plannedActivityId} /> : <ActivityView {...props} />;
}
