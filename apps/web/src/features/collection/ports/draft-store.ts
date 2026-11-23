/**
 * Where a long form in progress is kept (Phase 62.4). The filler knows only this port: online it is the server's draft (the same person can
 * continue on another device), on the field app it is this phone (so it survives no connection and a closed browser). A save quotes the
 * version it started from, so a stale copy cannot overwrite a newer one silently.
 */
/** A photo or signature taken but not yet sent: kept with a draft on the phone so it survives a closed browser. */
export interface DraftFile { name: string; type: string; blob: Blob }
export interface StoredDraft { answers: Record<string, unknown>; how: Record<string, string>; startedAt: string; updatedAt: string; files?: Record<string, DraftFile> }

export type DraftSaveResult = { ok: true; updatedAt: string } | { ok: false; reason: "CONFLICT" | "OFFLINE" | "ERROR"; message: string };

export interface DraftStore {
  load(formId: string, placeKey: string): Promise<StoredDraft | null>;
  save(formId: string, placeKey: string, draft: { answers: Record<string, unknown>; how: Record<string, string>; startedAt: string; files?: Record<string, DraftFile> }, expectedUpdatedAt: string | undefined): Promise<DraftSaveResult>;
  remove(formId: string, placeKey: string): Promise<void>;
}
