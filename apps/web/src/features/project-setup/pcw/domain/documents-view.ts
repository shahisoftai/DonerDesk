import type { SetupDraftView } from "../../../../lib/server/schemas-project-setup-draft.ts";

export interface FileLike { name: string; size: number }

/** Adds the chosen files to the ones already chosen: the same file twice is one, and there is a limit. */
export function addFiles<T extends FileLike>(current: readonly T[], incoming: readonly T[], max: number): T[] {
  const next = [...current];
  for (const file of incoming) if (next.length < max && !next.some((f) => f.name === file.name && f.size === file.size)) next.push(file);
  return next;
}

export type ReadingState = "READING" | "FAILED" | "READY";

/** Whether the documents are still being read, could not be read, or the draft is ready to work on. */
export function readingState(view: Pick<SetupDraftView, "status">): ReadingState {
  return view.status === "EXTRACTING" ? "READING" : view.status === "FAILED" ? "FAILED" : "READY";
}

/** The addresses of items nobody has decided yet, for "accept all that are waiting". */
export function waitingPaths(items: ReadonlyArray<{ path: string; status: string }>): string[] {
  return items.filter((i) => i.status === "PROPOSED").map((i) => i.path);
}

/** How often the page asks again while documents are being read (milliseconds). */
export const READING_POLL_MS = 3000;
