import type { Result } from "../../../lib/shared/result.ts";
import type { AppError } from "../../../lib/shared/app-error.ts";
import type { OutboxEntry, OutboxSender, SendOutcome } from "./outbox.ts";

export const COLLECTION_RECORD_KIND = "collection-record";

export interface QueuedAttachment {
  /** The question the file answers. */
  fieldKey: string;
  /**
   * Phase 62: the placeholder id the answers hold until the file is sent (a photo inside a table or a repeat has no single top-level
   * question). After the upload every occurrence of it in the answers becomes the real id. Absent on an entry made before Phase 62.
   */
  placeholder?: string;
  name: string;
  type: string;
  blob: Blob;
}

/** One form answered while offline: the answers as typed, the photos kept as they are, and what has been sent so far. */
export interface CollectionOutboxPayload {
  formId: string;
  answers: Record<string, unknown>;
  files: QueuedAttachment[];
  /** Question (or placeholder) -> the id the server gave the upload, saved after each upload so a retry sends only what is missing. */
  uploaded: Record<string, string>;
  /** Phase 62: the facility, how answers were established and when the person began. */
  placeId?: string;
  how?: Record<string, string>;
  startedAt?: string;
}

/** The entry id doubles as the record's own id, so a repeated send is stored once by the server. */
export function collectionRecordEntry(input: { id: string; title: string; payload: Omit<CollectionOutboxPayload, "uploaded">; now: number }): OutboxEntry<CollectionOutboxPayload> {
  return { id: input.id, kind: COLLECTION_RECORD_KIND, title: input.title, payload: { ...input.payload, uploaded: {} }, createdAt: input.now, attempts: 0, state: "waiting" };
}

export interface CollectionSendDeps {
  uploadFile(formId: string, file: File): Promise<Result<{ id: string }, AppError>>;
  submit(formId: string, input: { id: string; answers: Record<string, unknown>; placeId?: string; how?: Record<string, string>; startedAt?: string }): Promise<Result<unknown, AppError>>;
}

/** Replaces every string equal to `from` inside a tree of answers (objects, lists, rows) with `to`; the original is not changed. */
export function replaceToken(value: unknown, from: string, to: string): unknown {
  if (value === from) return to;
  if (Array.isArray(value)) return value.map((v) => replaceToken(v, from, to));
  if (typeof value === "object" && value !== null) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replaceToken(v, from, to)]));
  return value;
}

const toOutcome = (error: AppError): SendOutcome =>
  error.kind === "unavailable" || error.kind === "unauthenticated"
    // A signed-out phone cannot send yet; the record stays until the person signs in again.
    ? { kind: "offline", message: error.kind === "unauthenticated" ? "Sign in again to send this." : error.message }
    : { kind: "rejected", message: error.message };

/**
 * Sends one record: each photo first (progress saved after every one), then the answers. A form that has been closed or changed
 * since is refused by the server; the entry is then parked with the reason for a person to look at, and never retried by itself.
 */
export function createCollectionRecordSender(deps: CollectionSendDeps): OutboxSender {
  return async (entry, save): Promise<SendOutcome> => {
    const payload = entry.payload as CollectionOutboxPayload;
    const uploaded = { ...payload.uploaded };
    const slot = (f: QueuedAttachment): string => f.placeholder ?? f.fieldKey;
    for (const file of payload.files.filter((f) => !uploaded[slot(f)])) {
      const result = await deps.uploadFile(payload.formId, new File([file.blob], file.name, { type: file.type }));
      if (!result.ok) return toOutcome(result.error);
      uploaded[slot(file)] = result.value.id;
      await save({ payload: { ...payload, uploaded } });
    }
    // An older entry names the question; a newer one carries a placeholder that may sit anywhere in the answers (a table cell, a repeat row).
    let answers: Record<string, unknown> = { ...payload.answers };
    for (const f of payload.files) {
      if (f.placeholder) answers = replaceToken(answers, f.placeholder, uploaded[f.placeholder]!) as Record<string, unknown>;
      else answers[f.fieldKey] = uploaded[f.fieldKey];
    }
    const sent = await deps.submit(payload.formId, {
      id: entry.id, answers, ...(payload.placeId ? { placeId: payload.placeId } : {}), ...(payload.how && Object.keys(payload.how).length ? { how: payload.how } : {}), ...(payload.startedAt ? { startedAt: payload.startedAt } : {}),
    });
    return sent.ok ? { kind: "sent" } : toOutcome(sent.error);
  };
}
