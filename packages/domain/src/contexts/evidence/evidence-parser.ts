import { EVIDENCE_TYPES, CONFIDENTIALITY_LEVELS, type EvidenceType, type ConfidentialityLevel } from "./evidence-file.js";

export interface ParsedEvidenceRow {
  title: string;
  fileName: string;
  evidenceType: EvidenceType;
  confidentialityLevel: ConfidentialityLevel;
  location?: string;
  activityDate?: string;
  notes?: string;
  driveWebLink?: string;
  activityTitle?: string;
  indicatorCode?: string;
}

export interface ParseEvidenceResult {
  rows: ParsedEvidenceRow[];
  warnings: string[];
  /** True when a header row was detected and at least one row was parsed. */
  structured: boolean;
}

const TITLE_HEADERS: ReadonlyArray<string> = ["title", "evidencetitle", "name"];
const FILE_NAME_HEADERS: ReadonlyArray<string> = ["filename", "file", "filename"];
const TYPE_HEADERS: ReadonlyArray<string> = ["evidencetype", "type"];
const CONFIDENTIALITY_HEADERS: ReadonlyArray<string> = ["confidentialitylevel", "confidentiality"];
const LOCATION_HEADERS: ReadonlyArray<string> = ["location", "venue", "place"];
const ACTIVITY_DATE_HEADERS: ReadonlyArray<string> = ["activitydate", "date"];
const NOTES_HEADERS: ReadonlyArray<string> = ["notes", "description", "comment"];
const DRIVE_LINK_HEADERS: ReadonlyArray<string> = ["driveweblink", "drivelink", "weblink", "url", "link", "googledrivelink"];
const ACTIVITY_TITLE_HEADERS: ReadonlyArray<string> = ["activitytitle", "activity"];
const INDICATOR_CODE_HEADERS: ReadonlyArray<string> = ["indicatorcode", "indicator"];

const ALL_HEADERS: ReadonlyArray<string> = [
  ...TITLE_HEADERS,
  ...FILE_NAME_HEADERS,
  ...TYPE_HEADERS,
  ...CONFIDENTIALITY_HEADERS,
  ...LOCATION_HEADERS,
  ...ACTIVITY_DATE_HEADERS,
  ...NOTES_HEADERS,
  ...DRIVE_LINK_HEADERS,
  ...ACTIVITY_TITLE_HEADERS,
  ...INDICATOR_CODE_HEADERS,
];

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Splits a delimited line into cells using only the detected delimiter, so
 * text fields may safely contain the other punctuation characters.
 */
function splitDelimited(line: string, delimiter?: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  const splitsOn = delimiter ? (ch: string) => ch === delimiter : (ch: string) => ch === "\t" || ch === "," || ch === ";";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i] ?? "";
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (splitsOn(ch)) {
      if (inQuotes) {
        current += ch;
      } else {
        cells.push(current.trim());
        current = "";
      }
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function looksLikeHeaderRow(cells: string[]): boolean {
  const normalized = cells.map(normalizeHeader);
  return normalized.filter((h) => h && ALL_HEADERS.includes(h)).length >= 2;
}

function detectHeaderRow(lines: string[]): { index: number; delimiter: string } | null {
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const delimiter = trimmed.includes("\t")
      ? "\t"
      : trimmed.includes(",")
        ? ","
        : trimmed.includes(";")
          ? ";"
          : "";
    if (!delimiter) continue;
    const headers = splitDelimited(trimmed, delimiter).map(normalizeHeader);
    const hasTitle = headers.some((h) => TITLE_HEADERS.includes(h));
    const hasType = headers.some((h) => TYPE_HEADERS.includes(h));
    if (hasTitle && hasType) {
      return { index: i, delimiter };
    }
  }
  return null;
}

function normalizeType(value: string | undefined): EvidenceType | null {
  if (!value || !value.trim()) return null;
  const trimmed = value.trim().toUpperCase();
  if ((EVIDENCE_TYPES as string[]).includes(trimmed)) return trimmed as EvidenceType;
  const compact = trimmed.replace(/[\s_/-]+/g, "");
  const match = EVIDENCE_TYPES.find((t) => t.replace(/_/g, "").toLowerCase() === compact.toLowerCase());
  return match ?? null;
}

function normalizeConfidentiality(value: string | undefined): ConfidentialityLevel | null {
  if (!value || !value.trim()) return "INTERNAL";
  const trimmed = value.trim().toUpperCase();
  if ((CONFIDENTIALITY_LEVELS as string[]).includes(trimmed)) return trimmed as ConfidentialityLevel;
  const compact = trimmed.replace(/[\s_/-]+/g, "");
  const match = CONFIDENTIALITY_LEVELS.find((t) => t.replace(/_/g, "").toLowerCase() === compact.toLowerCase());
  return match ?? null;
}

function parseDate(value: string | undefined): string | undefined {
  if (!value || !value.trim()) return undefined;
  const trimmed = value.trim();
  // Excel serial dates arrive as bare numbers from General-formatted cells;
  // `new Date("45376")` is a valid year-only date, so reject them explicitly.
  if (/^\d+$/.test(trimmed)) return undefined;
  const date = new Date(trimmed);
  if (isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

/**
 * Parses evidence metadata extracted from an Excel/CSV/plain-text upload into
 * structured rows (Title / File Name / Evidence Type / Confidentiality Level /
 * Location / Activity Date / Notes / Drive Web Link). Link-first: each row
 * must carry a Google Drive share link to become a real record.
 */
export function parseEvidenceText(text: string): ParseEvidenceResult {
  const warnings: string[] = [];
  const cleaned = text.replace(/^\uFEFF/, "");
  if (!cleaned.trim()) return { rows: [], warnings, structured: false };

  const lines = cleaned.split(/\r?\n/);
  const header = detectHeaderRow(lines);
  if (!header) {
    return {
      rows: [],
      warnings: ["No evidence header row found. Expected columns: Title, File Name, Evidence Type."],
      structured: false,
    };
  }

  const headers = splitDelimited(lines[header.index]?.trim() ?? "", header.delimiter).map(normalizeHeader);
  const titleCol = headers.findIndex((h) => TITLE_HEADERS.includes(h));
  const fileNameCol = headers.findIndex((h) => FILE_NAME_HEADERS.includes(h));
  const typeCol = headers.findIndex((h) => TYPE_HEADERS.includes(h));
  const confidentialityCol = headers.findIndex((h) => CONFIDENTIALITY_HEADERS.includes(h));
  const locationCol = headers.findIndex((h) => LOCATION_HEADERS.includes(h));
  const dateCol = headers.findIndex((h) => ACTIVITY_DATE_HEADERS.includes(h));
  const notesCol = headers.findIndex((h) => NOTES_HEADERS.includes(h));
  const driveLinkCol = headers.findIndex((h) => DRIVE_LINK_HEADERS.includes(h));
  const activityTitleCol = headers.findIndex((h) => ACTIVITY_TITLE_HEADERS.includes(h));
  const indicatorCodeCol = headers.findIndex((h) => INDICATOR_CODE_HEADERS.includes(h));

  if (titleCol === -1) {
    return { rows: [], warnings: ["No Title column found in the header row."], structured: false };
  }

  const rows: ParsedEvidenceRow[] = [];
  let pendingSheetMarker = false;
  for (let i = header.index + 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) {
      pendingSheetMarker = true;
      continue;
    }
    const cells = splitDelimited(trimmed, header.delimiter);
    if (pendingSheetMarker) {
      if (looksLikeHeaderRow(cells)) break;
      pendingSheetMarker = false;
    }
    if (cells.length === 1 && (cells[0] ?? "") === "") continue;

    const title = titleCol >= 0 ? (cells[titleCol] ?? "").trim() : "";
    if (!title) continue;

    const fileName = fileNameCol >= 0 ? (cells[fileNameCol] ?? "").trim() : title;
    const evidenceType = typeCol >= 0 ? normalizeType(cells[typeCol]) : null;
    if (!evidenceType) {
      warnings.push(`Row ${i + 1} (${title}): invalid or missing Evidence Type; skipped.`);
      continue;
    }
    const confidentialityLevel = normalizeConfidentiality(confidentialityCol >= 0 ? cells[confidentialityCol] : undefined);
    if (!confidentialityLevel) {
      warnings.push(`Row ${i + 1} (${title}): invalid Confidentiality Level; skipped.`);
      continue;
    }

    rows.push({
      title,
      fileName,
      evidenceType,
      confidentialityLevel,
      location: locationCol >= 0 ? (cells[locationCol] ?? "").trim() || undefined : undefined,
      activityDate: dateCol >= 0 ? parseDate(cells[dateCol]) : undefined,
      notes: notesCol >= 0 ? (cells[notesCol] ?? "").trim() || undefined : undefined,
      driveWebLink: driveLinkCol >= 0 ? (cells[driveLinkCol] ?? "").trim() || undefined : undefined,
      activityTitle: activityTitleCol >= 0 ? (cells[activityTitleCol] ?? "").trim() || undefined : undefined,
      indicatorCode: indicatorCodeCol >= 0 ? (cells[indicatorCodeCol] ?? "").trim() || undefined : undefined,
    });
  }

  return { rows, warnings, structured: rows.length > 0 };
}
