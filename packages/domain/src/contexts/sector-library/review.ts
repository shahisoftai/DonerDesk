/**
 * Review of library content (Phase 46.7). Content starts UNREVIEWED and is never shown as more than that until a person records a
 * decision. A decision belongs to an organisation (it reviewed the entry for its own use) and is stored with the version it saw,
 * so a later version reads as unreviewed again. The reviewer sheet is a plain table that goes out and comes back: any bad row
 * blocks the whole import and names its row. Pure.
 */
import type { LibraryIndicator, ReviewState, LibraryReviewStatus } from "./model.js";

export interface LibraryReviewDecision { entryId: string; version: number; status: LibraryReviewStatus; reviewer: string; reviewedOn: string; note?: string }

export const REVIEW_LABEL: Readonly<Record<LibraryReviewStatus, string>> = {
  UNREVIEWED: "Not yet reviewed", IN_REVIEW: "Being reviewed", REVIEWED: "Reviewed", DEPRECATED: "Replaced",
};

/** The review state to show: the organisation's decision for this version, else what the content itself says. */
export function effectiveReview(entry: LibraryIndicator, decision: LibraryReviewDecision | undefined): ReviewState {
  if (decision && decision.entryId === entry.id && decision.version === entry.version) {
    return { status: decision.status, reviewer: decision.reviewer, reviewedOn: decision.reviewedOn, ...(decision.note ? { note: decision.note } : {}) };
  }
  return entry.review;
}

export const REVIEW_SHEET_HEADER = ["Id", "Version", "Sector", "Group", "Name", "Definition", "Kind", "Unit", "Direction", "Reference standard", "Source", "Status", "Reviewer", "Note"] as const;

const cell = (v: string | number | undefined | null): string => String(v ?? "").replace(/[\t\r\n]+/g, " ").trim();

export function reviewSheetRows(entries: readonly LibraryIndicator[], decisions: ReadonlyMap<string, LibraryReviewDecision>, describe: (e: LibraryIndicator) => string): string[][] {
  return entries.map((e) => {
    const state = effectiveReview(e, decisions.get(e.id));
    return [e.id, String(e.version), e.sectorId, e.group, e.name, e.definition, e.kind, e.unit, e.direction, describe(e), `${e.sourceRef.sourceId}${e.sourceRef.standard ? `: ${e.sourceRef.standard}` : ""}`, state.status, state.reviewer ?? "", state.note ?? ""].map(cell);
  });
}

export interface ReviewImportProblem { row: number; message: string }
export type ReviewImport = { ok: true; decisions: LibraryReviewDecision[] } | { ok: false; problems: ReviewImportProblem[] };

const SETTABLE: readonly LibraryReviewStatus[] = ["UNREVIEWED", "IN_REVIEW", "REVIEWED"];

/** Reads the returned sheet. Rows whose status did not change are skipped; any bad row blocks everything and is named. */
export function parseReviewSheet(rows: ReadonlyArray<ReadonlyArray<string>>, known: ReadonlyMap<string, LibraryIndicator>, who: string, today: string): ReviewImport {
  const problems: ReviewImportProblem[] = [];
  const decisions: LibraryReviewDecision[] = [];
  rows.forEach((r, i) => {
    const row = i + 2;
    const [id = "", version = "", , , , , , , , , , status = "", reviewer = "", note = ""] = r.map((c) => c.trim());
    const entry = known.get(id);
    if (!entry) { problems.push({ row, message: `"${id || "(blank)"}" is not an indicator in the library.` }); return; }
    if (Number(version) !== entry.version) { problems.push({ row, message: `${id} is version ${entry.version} now; this sheet was made for version ${version || "?"}. Export a new sheet.` }); return; }
    if (!(SETTABLE as readonly string[]).includes(status)) { problems.push({ row, message: `${id}: the status must be one of ${SETTABLE.join(", ")}.` }); return; }
    // A row that still says what the organisation sees now (same state, same reviewer or none) is not a decision.
    if (status === entry.review.status && (!reviewer || reviewer === (entry.review.reviewer ?? ""))) return;
    if (status === "REVIEWED" && !(reviewer || who)) { problems.push({ row, message: `${id}: a reviewed entry names who reviewed it.` }); return; }
    decisions.push({ entryId: id, version: entry.version, status: status as LibraryReviewStatus, reviewer: reviewer || who, reviewedOn: today, ...(note ? { note } : {}) });
  });
  return problems.length > 0 ? { ok: false, problems } : { ok: true, decisions };
}
