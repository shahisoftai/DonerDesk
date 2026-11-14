import type { CellValue } from "./model.js";

/**
 * Reading one cell as a number, a day, a month or yes/no. Pure and strict: a cell that cannot be read is `undefined` (a problem
 * the checks name), an empty cell is `null` ("Not reported", never 0). Thousands separators are read only when unambiguous.
 */
export const isBlank = (c: CellValue | undefined): boolean => c === null || c === undefined || (typeof c === "string" && c.trim() === "") || (typeof c === "string" && /^(n\/?a|-|—|\(blank\))$/i.test(c.trim()));

export function readNumber(c: CellValue | undefined): number | null | undefined {
  if (isBlank(c)) return null;
  if (typeof c === "number") return Number.isFinite(c) ? c : undefined;
  if (typeof c === "boolean") return undefined;
  let t = String(c).trim().replace(/\s+/g, "").replace(/%$/, "");
  // 1,234,567 or 1,234.5: commas group thousands. 1,5 alone is ambiguous and refused.
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, "");
  else if (t.includes(",")) return undefined;
  if (!/^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/i.test(t)) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

const MONTHS: Readonly<Record<string, number>> = {
  jan: 1, january: 1, janvier: 1, enero: 1, feb: 2, february: 2, fevrier: 2, février: 2, febrero: 2, mar: 3, march: 3, mars: 3, marzo: 3,
  apr: 4, april: 4, avril: 4, abril: 4, may: 5, mai: 5, mayo: 5, jun: 6, june: 6, juin: 6, junio: 6, jul: 7, july: 7, juillet: 7, julio: 7,
  aug: 8, august: 8, aout: 8, août: 8, agosto: 8, sep: 9, sept: 9, september: 9, septembre: 9, septiembre: 9, oct: 10, october: 10, octobre: 10, octubre: 10,
  nov: 11, november: 11, novembre: 11, noviembre: 11, dec: 12, december: 12, decembre: 12, décembre: 12, diciembre: 12,
};
export const monthNumber = (word: string): number | undefined => MONTHS[word.trim().toLowerCase().replace(/\.$/, "")];

const pad = (n: number): string => String(n).padStart(2, "0");
const validDay = (y: number, m: number, d: number): boolean => m >= 1 && m <= 12 && d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate();

/** A day as YYYY-MM-DD. Excel serial numbers are read; a slashed day is read only as day/month/year when the day is above 12. */
export function readDay(c: CellValue | undefined): string | null | undefined {
  if (isBlank(c)) return null;
  if (typeof c === "number") {
    if (c > 20000 && c < 80000) { const d = new Date(Date.UTC(1899, 11, 30) + Math.round(c) * 86400000); return d.toISOString().slice(0, 10); }
    return undefined;
  }
  const t = String(c).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(T.*)?$/.exec(t);
  if (m) { const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]; return validDay(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : undefined; }
  m = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(t);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]), y = Number(m[3]);
    if (a > 12 && validDay(y, b, a)) return `${y}-${pad(b)}-${pad(a)}`;
    if (b > 12 && validDay(y, a, b)) return `${y}-${pad(a)}-${pad(b)}`;
    return undefined; // 03/04/2026 could be either: refused, never guessed
  }
  m = /^(\d{1,2})[\s-]([A-Za-zéû]+)[\s-](\d{4})$/.exec(t);
  if (m) { const mo = monthNumber(m[2]!); const y = Number(m[3]), d = Number(m[1]); return mo && validDay(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : undefined; }
  return undefined;
}

/** A month as YYYY-MM: "2022-05", "May 2022", "May-22", "05/2022", a day (its month), or an Excel serial day. */
export function readMonth(c: CellValue | undefined): string | null | undefined {
  if (isBlank(c)) return null;
  if (typeof c === "number") { const d = readDay(c); return d ? d.slice(0, 7) : undefined; }
  const t = String(c).trim();
  let m = /^(\d{4})-(\d{1,2})$/.exec(t);
  if (m) { const mo = Number(m[2]); return mo >= 1 && mo <= 12 ? `${m[1]}-${pad(mo)}` : undefined; }
  m = /^(\d{1,2})[/.](\d{4})$/.exec(t);
  if (m) { const mo = Number(m[1]); return mo >= 1 && mo <= 12 ? `${m[2]}-${pad(mo)}` : undefined; }
  m = /^([A-Za-zéû]+)\.?[\s,\-']+(\d{2}|\d{4})$/.exec(t);
  if (m) { const mo = monthNumber(m[1]!); if (!mo) return undefined; const y = m[2]!.length === 2 ? 2000 + Number(m[2]) : Number(m[2]); return `${y}-${pad(mo)}`; }
  m = /^(\d{4})[\s-]([A-Za-zéû]+)$/.exec(t);
  if (m) { const mo = monthNumber(m[2]!); return mo ? `${m[1]}-${pad(mo)}` : undefined; }
  const d = readDay(c);
  return d ? d.slice(0, 7) : d === null ? null : undefined;
}

/** An epidemiological week as YYYY-Www ("2022-W07", "W7 2022", "2022 week 7"). */
export function readWeek(c: CellValue | undefined): string | null | undefined {
  if (isBlank(c)) return null;
  const t = String(c).trim();
  const m = /^(\d{4})[\s-]*(?:w|wk|week|epi[\s-]?week)\s*(\d{1,2})$/i.exec(t) ?? /^(?:w|wk|week|epi[\s-]?week)\s*(\d{1,2})[\s,-]+(\d{4})$/i.exec(t);
  if (!m) return undefined;
  const [year, week] = /^\d{4}$/.test(m[1]!) ? [m[1]!, Number(m[2])] : [m[2]!, Number(m[1])];
  return week >= 1 && week <= 53 ? `${year}-W${pad(week)}` : undefined;
}

export function readYesNo(c: CellValue | undefined): boolean | null | undefined {
  if (isBlank(c)) return null;
  if (typeof c === "boolean") return c;
  if (c === 1 || c === 0) return c === 1;
  const t = String(c).trim().toLowerCase();
  if (["yes", "y", "true", "oui", "sí", "si", "نعم", "1"].includes(t)) return true;
  if (["no", "n", "false", "non", "لا", "0"].includes(t)) return false;
  return undefined;
}

export const readText = (c: CellValue | undefined): string | null => (isBlank(c) ? null : String(c).trim());
