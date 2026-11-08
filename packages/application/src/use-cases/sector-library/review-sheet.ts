import type { LibraryIndicator, LibrarySectorId, Result } from "@donordesk/domain";
import { DomainError, REVIEW_SHEET_HEADER, describeStandard, effectiveReview, parseReviewSheet, reviewSheetRows } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock } from "../../ports/core.js";
import type { EffectiveLibraryService } from "../../services/effective-library.js";
import type { IOrganisationLibraryStore } from "../../ports/sector-library.js";

const describe = (e: LibraryIndicator): string => (e.referenceStandard ? `${describeStandard(e.referenceStandard)}${e.referenceStandard.verified ? "" : " (not yet verified)"}` : "");
const cell = (v: string): string => v.replace(/[\t\r\n]+/g, " ");

/** The reviewer sheet: a plain tab-separated table of the entries (optionally of some sectors) with their review state, to review in a spreadsheet and bring back. */
export class ExportReviewSheetHandler {
  constructor(private readonly library: EffectiveLibraryService) {}

  async handle(ctx: AuthenticatedContext, input: { sectors?: readonly LibrarySectorId[] | undefined }): Promise<Result<{ text: string; rows: number }, DomainError>> {
    const lib = await this.library.forTenant(ctx.tenant.tenantId);
    if (!lib.ok) return lib;
    const entries = lib.value.entries.filter((e) => !input.sectors?.length || input.sectors.includes(e.sectorId));
    const rows = reviewSheetRows(entries, lib.value.decisions, describe);
    return { ok: true, value: { text: [REVIEW_SHEET_HEADER.join("\t"), ...rows.map((r) => r.map(cell).join("\t"))].join("\n"), rows: rows.length } };
  }
}

/** Reads a returned reviewer sheet. Any bad row blocks the whole sheet and is named; `apply: false` only checks. */
export class ImportReviewSheetHandler {
  constructor(private readonly library: EffectiveLibraryService, private readonly store: IOrganisationLibraryStore, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, input: { text: string; reviewer: string; apply: boolean }): Promise<Result<{ decisions: number; problems: Array<{ row: number; message: string }>; applied: boolean }, DomainError>> {
    const lines = input.text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return { ok: false, error: DomainError.validation("The sheet has no rows.") };
    const header = lines[0]!.split("\t").map((h) => h.trim());
    if (REVIEW_SHEET_HEADER.some((h, i) => header[i] !== h)) return { ok: false, error: DomainError.validation("This is not a reviewer sheet from the library: the first row must be the one the export wrote.") };
    const lib = await this.library.forTenant(ctx.tenant.tenantId);
    if (!lib.ok) return lib;
    const rows = lines.slice(1).map((l) => l.split("\t"));
    // A row is compared with the state this organisation sees now, so a row that did not change is not a decision.
    const seen = new Map([...lib.value.byId].map(([id, e]) => [id, { ...e, review: effectiveReview(e, lib.value.decisions.get(id)) }] as const));
    const parsed = parseReviewSheet(rows, seen, input.reviewer.trim() || ctx.tenant.userId, this.clock.now().toISOString().slice(0, 10));
    if (!parsed.ok) return { ok: true, value: { decisions: 0, problems: parsed.problems, applied: false } };
    if (input.apply) {
      for (const d of parsed.decisions) {
        const r = d.status === "UNREVIEWED"
          ? await this.store.remove(ctx.tenant.tenantId, d.entryId, "REVIEW")
          : await this.store.upsert(ctx.tenant.tenantId, { entryId: d.entryId, kind: "REVIEW", payload: d, libraryVersion: d.version, updatedById: ctx.tenant.userId });
        if (!r.ok) return r;
      }
      await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "sector_library.review_imported", entityType: "library", entityId: "library", newValue: `${parsed.decisions.length} decisions` });
    }
    return { ok: true, value: { decisions: parsed.decisions.length, problems: [], applied: input.apply } };
  }
}
