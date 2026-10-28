/**
 * Connectors to other collection tools (Phase 33.7): many organisations already collect in KoboToolbox or SurveyCTO, so their
 * submissions are pulled into a DonorDesk form as records waiting for review, exactly as if they had been typed or sent by link.
 * This module is the pure part: what a connector is, what request to make, how to read the reply, and how a submission from
 * the other tool becomes an answer to a DonorDesk question. Nothing here touches the network.
 */
import { createHash } from "node:crypto";
import { DomainError } from "../../core/domain-error.js";
import { err, ok, type Result } from "../../core/result.js";
import { checkWebhookUrl } from "../integrations/webhook.js";
import type { FormDefinition, FormField } from "./form-rules.js";
import { validateSubmission } from "./form-rules.js";

export type ConnectorKind = "KOBOTOOLBOX" | "SURVEYCTO";
export const CONNECTOR_KINDS: readonly ConnectorKind[] = ["KOBOTOOLBOX", "SURVEYCTO"];

export const CONNECTOR_LABEL: Readonly<Record<ConnectorKind, string>> = { KOBOTOOLBOX: "KoboToolbox", SURVEYCTO: "SurveyCTO" };

/** Which question gets which field of the other tool. */
export interface FieldMapping {
  /** The field's name in the other tool (a Kobo "group/field" path or a SurveyCTO column). */
  sourceField: string;
  /** The key of the DonorDesk question. */
  formKey: string;
}

export interface ConnectorConfig {
  kind: ConnectorKind;
  /** https address of the server: `https://kf.kobotoolbox.org`, `https://myteam.surveycto.com`. */
  serverUrl: string;
  /** KoboToolbox: the asset uid. SurveyCTO: the form id. */
  sourceId: string;
  fieldMap: FieldMapping[];
}

export const MAX_ROWS_PER_PAGE = 500;
export const MAX_PAGES_PER_SYNC = 5;

const SOURCE_ID = /^[A-Za-z0-9_.-]{3,80}$/;

/** What is wrong with a connector, as sentences; an empty list means it can be saved. */
export function connectorProblems(config: ConnectorConfig, form: FormDefinition): string[] {
  const problems: string[] = [];
  if (!CONNECTOR_KINDS.includes(config.kind)) problems.push("Choose KoboToolbox or SurveyCTO.");
  const url = checkWebhookUrl(config.serverUrl);
  if (!url.ok) problems.push(`The server address: ${url.error.message}`);
  if (!SOURCE_ID.test(config.sourceId.trim())) problems.push(config.kind === "SURVEYCTO" ? "The form id is not valid (letters, numbers, dashes and underscores)." : "The form's id (asset uid) is not valid (letters and numbers).");
  const keys = new Set(form.fields.map((f) => f.key));
  const seenKey = new Set<string>();
  const seenSource = new Set<string>();
  for (const m of config.fieldMap) {
    if (!m.sourceField.trim()) { problems.push("A mapping has no field name from the other tool."); continue; }
    if (!keys.has(m.formKey)) problems.push(`"${m.sourceField}" is mapped to a question this form does not have.`);
    else if (form.fields.find((f) => f.key === m.formKey)?.type === "FILE") problems.push(`"${m.sourceField}": photos and documents cannot be brought in this way.`);
    if (seenKey.has(m.formKey)) problems.push("Two fields are mapped to the same question.");
    if (seenSource.has(m.sourceField.trim().toLowerCase())) problems.push(`"${m.sourceField}" is mapped twice.`);
    seenKey.add(m.formKey);
    seenSource.add(m.sourceField.trim().toLowerCase());
  }
  if (config.fieldMap.length === 0) problems.push("Map at least one field.");
  // A required question nobody maps would make every submission fail, so say it once, up front.
  for (const f of form.fields) if (f.required === true && f.type !== "FILE" && !seenKey.has(f.key)) problems.push(`"${f.label}" is required but no field is mapped to it.`);
  return problems;
}

export interface ConnectorRequest {
  url: string;
  headers: Record<string, string>;
}

/**
 * The request for one page of submissions. The credential is the KoboToolbox API token, or `user:password` for SurveyCTO.
 * `cursor` is the submission time already brought in (ISO), so only newer ones are asked for.
 */
export function connectorRequest(config: ConnectorConfig, credential: string, cursor: string | undefined, offset = 0): Result<ConnectorRequest, DomainError> {
  const base = checkWebhookUrl(config.serverUrl);
  if (!base.ok) return base;
  const origin = base.value.origin;
  if (config.kind === "KOBOTOOLBOX") {
    const query = cursor ? `&query=${encodeURIComponent(JSON.stringify({ _submission_time: { $gte: cursor } }))}` : "";
    return ok({
      url: `${origin}/api/v2/assets/${encodeURIComponent(config.sourceId.trim())}/data/?format=json&limit=${MAX_ROWS_PER_PAGE}&start=${offset}&sort=${encodeURIComponent('{"_submission_time":1}')}${query}`,
      headers: { authorization: `Token ${credential.trim()}`, accept: "application/json" },
    });
  }
  // SurveyCTO: the wide JSON export, newer than the last submission time (milliseconds; 0 asks for everything).
  // SurveyCTO times are in the server's own zone, which is not told to us, so ask for a day more than the cursor says: a submission
  // is recognised if it comes again and is stored once, whereas one skipped would be lost.
  const since = cursor ? Date.parse(cursor) - 86_400_000 : 0;
  const date = Number.isFinite(since) && since > 0 ? since : 0;
  return ok({
    url: `${origin}/api/v2/forms/data/wide/json/${encodeURIComponent(config.sourceId.trim())}?date=${date}`,
    headers: { authorization: `Basic ${Buffer.from(credential.trim()).toString("base64")}`, accept: "application/json" },
  });
}

export interface ExternalRow {
  /** The other tool's own id for the submission; the same submission always has the same one. */
  externalId: string;
  /** ISO time the other tool received it. */
  submittedAt: string;
  values: Record<string, unknown>;
}

export interface ExternalPage {
  rows: ExternalRow[];
  /** KoboToolbox: another page follows. */
  hasMore: boolean;
}

/**
 * A time as ISO. KoboToolbox writes UTC without a zone ("2026-10-04T08:00:00"), which a parser would read as local time, so a time
 * with no zone is read as UTC. (SurveyCTO writes its server's local time; see the margin in `connectorRequest`.)
 */
const asIso = (text: unknown): string | null => {
  if (typeof text !== "string" || !text.trim()) return null;
  const trimmed = text.trim();
  const t = Date.parse(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(trimmed) ? `${trimmed}Z` : trimmed);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

/** Reads one reply. A row without an id or a time is dropped and counted by the caller through `skipped`. */
export function parseExternalPage(kind: ConnectorKind, json: unknown): { page: ExternalPage; skipped: number } {
  let skipped = 0;
  const rows: ExternalRow[] = [];
  const asRows = (list: unknown): Array<Record<string, unknown>> => (Array.isArray(list) ? list.filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null && !Array.isArray(r)) : []);
  if (kind === "KOBOTOOLBOX") {
    const body = (typeof json === "object" && json !== null ? json : {}) as { results?: unknown; next?: unknown };
    for (const r of asRows(body.results)) {
      const id = r._uuid ?? r._id;
      const at = asIso(r._submission_time);
      if ((typeof id !== "string" && typeof id !== "number") || !at) { skipped += 1; continue; }
      rows.push({ externalId: String(id), submittedAt: at, values: r });
    }
    return { page: { rows, hasMore: typeof body.next === "string" && body.next.length > 0 }, skipped };
  }
  for (const r of asRows(json)) {
    const id = r.KEY ?? r.key;
    const at = asIso(r.SubmissionDate ?? r.submissiondate);
    if (typeof id !== "string" || !at) { skipped += 1; continue; }
    rows.push({ externalId: id, submittedAt: at, values: r });
  }
  return { page: { rows, hasMore: false }, skipped };
}

const fold = (s: string): string => s.trim().toLowerCase();

/** A field of the other tool by name: the exact name, then the same name inside a group ("group/field"), ignoring case. */
export function externalValue(values: Record<string, unknown>, sourceField: string): unknown {
  const want = fold(sourceField);
  if (sourceField in values) return values[sourceField];
  const entries = Object.entries(values);
  const exact = entries.find(([k]) => fold(k) === want);
  if (exact) return exact[1];
  const last = (k: string) => fold(k.split("/").pop() ?? k);
  return entries.find(([k]) => last(k) === last(sourceField))?.[1];
}

const MONTHS: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };

function toDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(t);
  if (iso) return iso[1];
  const long = /^([A-Za-z]{3})[a-z]*\s+(\d{1,2}),\s*(\d{4})/.exec(t); // "Oct 28, 2026" (SurveyCTO)
  const month = long ? MONTHS[long[1]!.toLowerCase()] : undefined;
  if (long && month) return `${long[3]}-${month}-${long[2]!.padStart(2, "0")}`;
  return undefined;
}

/** One value of the other tool as an answer to one question. `undefined` means nothing usable was there. */
export function toAnswer(field: FormField, value: unknown): unknown {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  switch (field.type) {
    case "DATE": return toDate(value) ?? String(value);
    case "SELECT": {
      const t = String(value).trim().toLowerCase();
      const hit = (field.options ?? []).find((o) => o.value.toLowerCase() === t || o.label.toLowerCase() === t);
      return hit ? hit.value : String(value).trim();
    }
    case "GPS": {
      // KoboToolbox writes "lat lon altitude accuracy"; SurveyCTO writes "lat lon" in separate columns or the same shape.
      const parts = String(value).trim().split(/[\s,]+/);
      return parts.length >= 2 ? { lat: parts[0], lon: parts[1] } : String(value);
    }
    case "NUMBER": return typeof value === "number" ? value : String(value).replace(/,/g, "").trim();
    default: return typeof value === "string" ? value.trim() : value;
  }
}

export interface MappedRow {
  externalId: string;
  submittedAt: string;
  answers: Record<string, unknown>;
  /** The values that passed the form's own rules, in the form's shape; empty when there are problems. */
  stored: Record<string, unknown>;
  problems: string[];
}

/** Maps one submission of the other tool onto the form and checks it with the form's own rules. */
export function mapExternalRow(row: ExternalRow, fieldMap: ReadonlyArray<FieldMapping>, form: FormDefinition): MappedRow {
  const answers: Record<string, unknown> = {};
  for (const m of fieldMap) {
    const field = form.fields.find((f) => f.key === m.formKey);
    if (!field) continue;
    const a = toAnswer(field, externalValue(row.values, m.sourceField));
    if (a !== undefined) answers[m.formKey] = a;
  }
  const checked = validateSubmission(form, answers);
  return { externalId: row.externalId, submittedAt: row.submittedAt, answers, stored: checked.problems.length === 0 ? checked.values : {}, problems: checked.problems.map((p) => p.message) };
}

/** The id a record brought in from the other tool is stored under: the same submission is always the same record, however often it is pulled. */
export function connectorRecordId(connectorId: string, externalId: string): string {
  return `ext-${createHash("sha256").update(`${connectorId}\u0000${externalId}`).digest("hex").slice(0, 40)}`;
}

export interface SyncSummary {
  read: number;
  created: number;
  alreadyHad: number;
  rejected: number;
  skipped: number;
  /** The first few problems, each naming the submission, so the mapping can be fixed. */
  problems: string[];
}

export const emptySummary = (): SyncSummary => ({ read: 0, created: 0, alreadyHad: 0, rejected: 0, skipped: 0, problems: [] });
export const MAX_REPORTED_PROBLEMS = 10;
