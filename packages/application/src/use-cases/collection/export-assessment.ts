import { DomainError, buildAssessmentDocument, computeScore, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAssessmentFiles, ICollectionFormRepository, ICollectionRecordRepository } from "../../ports/collection.js";
import type { IPlaceRepository } from "../../ports/places.js";
import { can, fail, loadForm, ok } from "./assessment-common.js";

export type AssessmentFileFormat = "PDF" | "DOCX" | "XLSX";
/** Arabic, Urdu, Pashto and Persian script: the PDF engine cannot shape it, so those go out as Word or Excel. */
const COMPLEX_SCRIPT = /[؀-ۿݐ-ݿ]/;

/** A completed assessment as a file in the form's own layout, from the stored answers (nothing is recomputed from the browser). */
export class ExportAssessmentHandler {
  constructor(private readonly forms: Pick<ICollectionFormRepository, "findById">, private readonly records: Pick<ICollectionRecordRepository, "findById">, private readonly places: Pick<IPlaceRepository, "findById">, private readonly files: IAssessmentFiles) {}

  async handle(ctx: AuthenticatedContext, recordId: string, format: AssessmentFileFormat, language?: string): Promise<Result<{ fileName: string; contentType: string; bytes: Buffer }, DomainError>> {
    if (!can(ctx, "indicator.update") && !can(ctx, "indicator.verify")) return fail(DomainError.forbidden("You cannot see collected records"));
    const found = await this.records.findById(recordId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return fail(DomainError.notFound("Record", recordId));
    const record = found.value;
    const form = await loadForm(this.forms, record.formId, ctx.tenant.tenantId);
    if (!form.ok) return form;
    const { localizeForm, isRtlLanguage } = await import("@donordesk/domain");
    const def = localizeForm(form.value.definition, language);
    const place = record.placeId ? await this.places.findById(record.placeId, ctx.tenant.tenantId) : undefined;
    const score = form.value.definition.score ? computeScore(form.value.definition.score, record.answers) : undefined;
    const doc = buildAssessmentDocument(def, form.value.name, record.answers, record.how ?? {}, score, { ...(place?.ok && place.value ? { facility: place.value.name } : {}), visitedOn: record.submittedOn });
    const text = JSON.stringify(doc);
    if (format === "PDF" && COMPLEX_SCRIPT.test(text)) return fail(DomainError.validation("This assessment is written in a right-to-left script that a PDF cannot show correctly. Download it as Word or Excel instead."));
    const base = `${form.value.name}${doc.facility ? ` - ${doc.facility}` : ""}`.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 80) || "assessment";
    if (format === "PDF") return ok({ fileName: `${base}.pdf`, contentType: "application/pdf", bytes: await this.files.pdf(doc) });
    if (format === "DOCX") return ok({ fileName: `${base}.docx`, contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", bytes: await this.files.docx(doc, { rtl: isRtlLanguage(language) }) });
    return ok({ fileName: `${base}.xlsx`, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes: await this.files.xlsx(doc) });
  }
}
