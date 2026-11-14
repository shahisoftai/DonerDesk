import { checkWebhookUrl } from "../integrations/webhook.js";
import { err, ok, type Result } from "../../core/result.js";
import { DomainError } from "../../core/domain-error.js";
import type { RawTable } from "./model.js";

/**
 * Connectors that fill a dataset (Phase 54, §3.10). A row of `DATASET_CONNECTOR_DEFS` builds the request for a pull and turns the reply
 * into a raw table; the dataset's own tidy steps, checks and refresh rules then apply as for an upload. Nothing branches on a
 * connector's name. Calls go to https and public addresses only (the existing `SafeConnectorHttp`), and the key is stored encrypted.
 *
 * DHIS2 (D5): `analytics` for chosen data elements and organisation units over a period range, one row per org unit × period with a
 * column per data element. Org units are matched to places by code or alias at save time like any place column; an ambiguous unit is
 * listed, never imported into a place.
 */
export interface DatasetConnectorConfig {
  kind: string;
  serverUrl: string;
  /** DHIS2: data element (or indicator) ids, comma-separated. */
  dataElements: string[];
  /** DHIS2: organisation unit ids or a level ("LEVEL-3"). */
  orgUnits: string[];
  /** Periods in DHIS2 notation ("LAST_12_MONTHS", "202401;202402"). */
  periods: string;
  schedule: "MANUAL" | "DAILY" | "WEEKLY" | "MONTHLY";
}

export interface ConnectorCall { url: string; headers: Record<string, string> }

export interface DatasetConnectorDef {
  kind: string;
  label: string;
  /** What the person types as the key ("username:password" or a personal access token). */
  credentialHint: string;
  problems(config: DatasetConnectorConfig): string[];
  request(config: DatasetConnectorConfig, credential: string): Result<ConnectorCall, DomainError>;
  parse(json: unknown): Result<RawTable, DomainError>;
}

const ID = /^[A-Za-z0-9]{11}$/;
const LEVEL = /^(LEVEL-\d|USER_ORGUNIT|USER_ORGUNIT_CHILDREN)$/;
const PERIOD = /^([A-Z_0-9]+)(;[A-Z_0-9]+)*$/;

const DHIS2: DatasetConnectorDef = {
  kind: "DHIS2",
  label: "DHIS2",
  credentialHint: "A personal access token, or username:password",
  problems: (c) => {
    const out: string[] = [];
    if (c.dataElements.length === 0 || c.dataElements.length > 50 || c.dataElements.some((d) => !ID.test(d))) out.push("Give between 1 and 50 data element ids (11 letters and digits each).");
    if (c.orgUnits.length === 0 || c.orgUnits.some((o) => !ID.test(o) && !LEVEL.test(o))) out.push("Give organisation unit ids or a level such as LEVEL-3.");
    if (!PERIOD.test(c.periods.trim())) out.push("Give the periods as DHIS2 writes them, for example LAST_12_MONTHS or 202401;202402.");
    return out;
  },
  request: (c, credential) => {
    const base = checkWebhookUrl(c.serverUrl);
    if (!base.ok) return base;
    const root = base.value.toString().replace(/\/+$/, "");
    const dx = c.dataElements.join(";");
    const ou = c.orgUnits.join(";");
    const url = `${root}/api/analytics.json?dimension=dx:${encodeURIComponent(dx)}&dimension=ou:${encodeURIComponent(ou)}&dimension=pe:${encodeURIComponent(c.periods.trim())}&displayProperty=NAME&outputIdScheme=NAME&skipMeta=false&ignoreLimit=false`;
    const auth = credential.includes(":") ? `Basic ${Buffer.from(credential.trim()).toString("base64")}` : `ApiToken ${credential.trim()}`;
    return ok({ url, headers: { authorization: auth, accept: "application/json" } });
  },
  parse: (json) => {
    const body = (typeof json === "object" && json !== null ? json : {}) as { headers?: Array<{ name?: string }>; rows?: unknown[][]; metaData?: { items?: Record<string, { name?: string; code?: string }> } };
    if (!Array.isArray(body.headers) || !Array.isArray(body.rows)) return err(DomainError.validation("DHIS2 did not answer with an analytics table."));
    const at = (n: string) => body.headers!.findIndex((h) => h.name === n);
    const [dx, ou, pe, value] = [at("dx"), at("ou"), at("pe"), at("value")];
    if ([dx, ou, pe, value].some((i) => i < 0)) return err(DomainError.validation("DHIS2's answer lacks the data, unit, period or value column."));
    const elements = [...new Set(body.rows.map((r) => String(r[dx] ?? "")))].sort();
    const byKey = new Map<string, Record<string, number | string | null>>();
    for (const r of body.rows) {
      const unit = String(r[ou] ?? ""), period = String(r[pe] ?? ""), el = String(r[dx] ?? "");
      const k = `${unit}\u0000${period}`;
      const row = byKey.get(k) ?? { "Org unit": unit, Period: dhisPeriod(period) };
      const n = Number(r[value]);
      row[el] = Number.isFinite(n) ? n : null;
      byKey.set(k, row);
    }
    const headers = ["Org unit", "Period", ...elements];
    return ok({ headers, rows: [...byKey.values()].map((row) => headers.map((h) => row[h] ?? null)) });
  },
};

/** "202401" → "2024-01"; "2024W7" → "2024-W07"; anything else as given (a check names it when it cannot be read). */
export function dhisPeriod(p: string): string {
  let m = /^(\d{4})(\d{2})$/.exec(p);
  if (m) return `${m[1]}-${m[2]}`;
  m = /^(\d{4})W(\d{1,2})$/.exec(p);
  if (m) return `${m[1]}-W${m[2]!.padStart(2, "0")}`;
  return p;
}

export const DATASET_CONNECTOR_DEFS: readonly DatasetConnectorDef[] = [DHIS2];
const BY_KIND = new Map(DATASET_CONNECTOR_DEFS.map((d) => [d.kind, d]));
export const datasetConnectorDef = (kind: string): DatasetConnectorDef | undefined => BY_KIND.get(kind);

/** When the next scheduled pull is due (ISO), from the last one; MANUAL never. */
export function nextPullAt(schedule: DatasetConnectorConfig["schedule"], last: Date | undefined, now: Date): Date | undefined {
  const days: Record<DatasetConnectorConfig["schedule"], number | undefined> = { MANUAL: undefined, DAILY: 1, WEEKLY: 7, MONTHLY: 30 };
  const d = days[schedule];
  if (d === undefined) return undefined;
  return last ? new Date(last.getTime() + d * 86400000) : now;
}
