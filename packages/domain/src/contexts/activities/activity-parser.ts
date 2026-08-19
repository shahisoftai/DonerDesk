export interface ParsedActivityRow {
  activityTitle: string;
  activityDate: string;
  location?: string;
  outputCode?: string;
  indicatorCode?: string;
  participantsTotal?: number;
  participantsMale?: number;
  participantsFemale?: number;
  participantsChildren?: number;
  participantsDisability?: number;
  participantsOther?: string;
  summary: string;
  achievements?: string;
  challenges?: string;
  lessonsLearned?: string;
  nextSteps?: string;
}

export interface ParseActivityResult {
  rows: ParsedActivityRow[];
  warnings: string[];
  /** True when a header row was detected and at least one row was parsed. */
  structured: boolean;
}

const TITLE_HEADERS: ReadonlyArray<string> = ["activitytitle", "title", "activity"];
const DATE_HEADERS: ReadonlyArray<string> = ["activitydate", "date"];
const LOCATION_HEADERS: ReadonlyArray<string> = ["location", "venue", "place"];
const OUTPUT_CODE_HEADERS: ReadonlyArray<string> = ["outputcode", "output", "outputitemcode", "outputcode"];
const INDICATOR_CODE_HEADERS: ReadonlyArray<string> = ["indicatorcode", "indicator"];
const PARTICIPANTS_TOTAL_HEADERS: ReadonlyArray<string> = ["participantstotal", "participants", "totalparticipants", "participantscount"];
const MALE_HEADERS: ReadonlyArray<string> = ["participantsmale", "male", "maleparticipants"];
const FEMALE_HEADERS: ReadonlyArray<string> = ["participantsfemale", "female", "femaleparticipants"];
const CHILDREN_HEADERS: ReadonlyArray<string> = ["participantschildren", "children", "childrenparticipants"];
const DISABILITY_HEADERS: ReadonlyArray<string> = ["participantsdisability", "disability", "participantwithdisability"];
const OTHER_HEADERS: ReadonlyArray<string> = ["participantsother", "other", "otherparticipants"];
const SUMMARY_HEADERS: ReadonlyArray<string> = ["summary", "narrative", "description"];
const ACHIEVEMENTS_HEADERS: ReadonlyArray<string> = ["achievements", "achievement", "keyachievements"];
const CHALLENGES_HEADERS: ReadonlyArray<string> = ["challenges", "challenge", "difficulties"];
const LESSONS_HEADERS: ReadonlyArray<string> = ["lessonslearned", "lessons", "lesson"];
const NEXT_STEPS_HEADERS: ReadonlyArray<string> = ["nextsteps", "nextstep", "next"];

const ALL_HEADERS: ReadonlyArray<string> = [
  ...TITLE_HEADERS,
  ...DATE_HEADERS,
  ...LOCATION_HEADERS,
  ...OUTPUT_CODE_HEADERS,
  ...INDICATOR_CODE_HEADERS,
  ...PARTICIPANTS_TOTAL_HEADERS,
  ...MALE_HEADERS,
  ...FEMALE_HEADERS,
  ...CHILDREN_HEADERS,
  ...DISABILITY_HEADERS,
  ...OTHER_HEADERS,
  ...SUMMARY_HEADERS,
  ...ACHIEVEMENTS_HEADERS,
  ...CHALLENGES_HEADERS,
  ...LESSONS_HEADERS,
  ...NEXT_STEPS_HEADERS,
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
    const hasDate = headers.some((h) => DATE_HEADERS.includes(h));
    const hasSummary = headers.some((h) => SUMMARY_HEADERS.includes(h));
    if (hasTitle && (hasDate || hasSummary)) {
      return { index: i, delimiter };
    }
  }
  return null;
}

function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value || !value.trim()) return undefined;
  const n = Number(value.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n);
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
 * Parses activity content extracted from an Excel/CSV/plain-text upload into
 * structured rows (Activity Title / Activity Date / Location / Output Code /
 * Indicator Code / participant counts / narrative fields). Header rows are
 * matched fuzzily; parsing stops at the next sheet's header.
 */
export function parseActivityText(text: string): ParseActivityResult {
  const warnings: string[] = [];
  const cleaned = text.replace(/^\uFEFF/, "");
  if (!cleaned.trim()) return { rows: [], warnings, structured: false };

  const lines = cleaned.split(/\r?\n/);
  const header = detectHeaderRow(lines);
  if (!header) {
    return {
      rows: [],
      warnings: ["No activity header row found. Expected columns: Activity Title, Activity Date, Summary."],
      structured: false,
    };
  }

  const headers = splitDelimited(lines[header.index]?.trim() ?? "", header.delimiter).map(normalizeHeader);
  const titleCol = headers.findIndex((h) => TITLE_HEADERS.includes(h));
  const dateCol = headers.findIndex((h) => DATE_HEADERS.includes(h));
  const locationCol = headers.findIndex((h) => LOCATION_HEADERS.includes(h));
  const outputCodeCol = headers.findIndex((h) => OUTPUT_CODE_HEADERS.includes(h));
  const indicatorCodeCol = headers.findIndex((h) => INDICATOR_CODE_HEADERS.includes(h));
  const totalCol = headers.findIndex((h) => PARTICIPANTS_TOTAL_HEADERS.includes(h));
  const maleCol = headers.findIndex((h) => MALE_HEADERS.includes(h));
  const femaleCol = headers.findIndex((h) => FEMALE_HEADERS.includes(h));
  const childrenCol = headers.findIndex((h) => CHILDREN_HEADERS.includes(h));
  const disabilityCol = headers.findIndex((h) => DISABILITY_HEADERS.includes(h));
  const otherCol = headers.findIndex((h) => OTHER_HEADERS.includes(h));
  const summaryCol = headers.findIndex((h) => SUMMARY_HEADERS.includes(h));
  const achievementsCol = headers.findIndex((h) => ACHIEVEMENTS_HEADERS.includes(h));
  const challengesCol = headers.findIndex((h) => CHALLENGES_HEADERS.includes(h));
  const lessonsCol = headers.findIndex((h) => LESSONS_HEADERS.includes(h));
  const nextStepsCol = headers.findIndex((h) => NEXT_STEPS_HEADERS.includes(h));

  if (titleCol === -1) {
    return { rows: [], warnings: ["No Title column found in the header row."], structured: false };
  }

  const rows: ParsedActivityRow[] = [];
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

    const rawDate = dateCol >= 0 ? (cells[dateCol] ?? "").trim() : "";
    const activityDate = rawDate ? parseDate(rawDate) : undefined;
    if (!activityDate) {
      warnings.push(`Row ${i + 1} (${title}): missing or invalid activity date; skipped.`);
      continue;
    }

    const summary = summaryCol >= 0 ? (cells[summaryCol] ?? "").trim() : "";
    if (!summary) {
      warnings.push(`Row ${i + 1} (${title}): missing summary; skipped.`);
      continue;
    }

    rows.push({
      activityTitle: title,
      activityDate,
      location: locationCol >= 0 ? (cells[locationCol] ?? "").trim() || undefined : undefined,
      outputCode: outputCodeCol >= 0 ? (cells[outputCodeCol] ?? "").trim() || undefined : undefined,
      indicatorCode: indicatorCodeCol >= 0 ? (cells[indicatorCodeCol] ?? "").trim() || undefined : undefined,
      participantsTotal: totalCol >= 0 ? parsePositiveInt(cells[totalCol]) : undefined,
      participantsMale: maleCol >= 0 ? parsePositiveInt(cells[maleCol]) : undefined,
      participantsFemale: femaleCol >= 0 ? parsePositiveInt(cells[femaleCol]) : undefined,
      participantsChildren: childrenCol >= 0 ? parsePositiveInt(cells[childrenCol]) : undefined,
      participantsDisability: disabilityCol >= 0 ? parsePositiveInt(cells[disabilityCol]) : undefined,
      participantsOther: otherCol >= 0 ? (cells[otherCol] ?? "").trim() || undefined : undefined,
      summary,
      achievements: achievementsCol >= 0 ? (cells[achievementsCol] ?? "").trim() || undefined : undefined,
      challenges: challengesCol >= 0 ? (cells[challengesCol] ?? "").trim() || undefined : undefined,
      lessonsLearned: lessonsCol >= 0 ? (cells[lessonsCol] ?? "").trim() || undefined : undefined,
      nextSteps: nextStepsCol >= 0 ? (cells[nextStepsCol] ?? "").trim() || undefined : undefined,
    });
  }

  return { rows, warnings, structured: rows.length > 0 };
}
