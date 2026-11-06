import type { Capability } from "@/lib/shared/capabilities";
import type { RecordDeps } from "../composition";
import type { RecordKind } from "../domain/record-kinds";

/** What every kind's view in the sheet receives. A view loads what it needs through `deps` and decides nothing about other kinds. */
export interface KindViewProps {
  deps: RecordDeps;
  kind: RecordKind;
  projectId: string;
  today: string;
  can: (capability: Capability) => boolean;
  /** An indicator to start on, when the opener named one. */
  indicatorId?: string | undefined;
  /** A planned item the person came from ("Finished?"): the Activity view asks what happened to it first. */
  plannedActivityId?: string | undefined;
  onClose: () => void;
}
