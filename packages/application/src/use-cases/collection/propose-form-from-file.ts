import { DomainError, proposeFormFromText, validateFormDefinition, type FormProposal, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IDocumentParser } from "../../ports/evidence.js";
import { can, fail, ok } from "./assessment-common.js";

export const MAX_TOOL_FILE_BYTES = 10 * 1024 * 1024;

/**
 * "Make a form from my tool" (Phase 62.10): reads a Word, Excel or text file and proposes sections, questions and tables, each with the
 * line it came from. It saves nothing: the person reviews the proposal and saves it as a draft like any form. A file whose words could
 * not be read is a refusal with a sentence, never an empty proposal.
 */
export class ProposeFormFromFileHandler {
  constructor(private readonly parser: IDocumentParser) {}

  async handle(ctx: AuthenticatedContext, file: { name: string; bytes: Buffer; type?: string }): Promise<Result<FormProposal & { problems: string[] }, DomainError>> {
    if (!can(ctx, "project.edit")) return fail(DomainError.forbidden("You cannot design forms"));
    if (file.bytes.length === 0) return fail(DomainError.validation("That file is empty."));
    if (file.bytes.length > MAX_TOOL_FILE_BYTES) return fail(DomainError.validation("That file is larger than 10 MB."));
    const parsed = await this.parser.parse({ buffer: file.bytes, fileType: file.type ?? "", fileName: file.name });
    if (!parsed.text.trim()) return fail(DomainError.validation("No words could be read from that file. If it is a scan, type it into a Word or Excel file first."));
    const proposal = proposeFormFromText(parsed.text);
    if (proposal.fields.length === 0) return fail(DomainError.validation("No questions were found in that file. Check that the questions are in a table or on separate lines."));
    const problems = validateFormDefinition({ fields: proposal.fields.map((p) => p.field) }).map((p) => p.message);
    return ok({ ...proposal, problems });
  }
}
