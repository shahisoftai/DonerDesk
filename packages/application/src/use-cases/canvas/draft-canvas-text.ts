import { DomainError, aiGate, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ICanvasAiSetting } from "../../ports/canvas.js";
import type { AskProjectHandler } from "../ask/ask-project.js";
import type { GetInfographicAiTextHandler } from "../infographics/studio.js";
import { can, fail, ok } from "./canvas-shared.js";

export type DraftStyle = "SUMMARY" | "MESSAGES" | "QUESTION";
export type CanvasDraft = { available: false; reason: string } | { available: true; text: string; dropped: number; note: string };
const ASK_NOTE = "Drafted from the project's records. Every figure was checked against them. Read it, then tick Accepted.";

/**
 * Proposes the words of an AI block. Nothing is saved: the text arrives in the editor as a draft a person reads, changes and accepts.
 * Off means off (the organisation must have AI and canvas AI switched on), partners never see it, and a sentence whose figures are not
 * in the records is dropped before anyone sees it. Asking a question goes through Ask, which already grounds every sentence in a source.
 */
export class DraftCanvasTextHandler {
  constructor(private readonly setting: ICanvasAiSetting, private readonly writer: GetInfographicAiTextHandler, private readonly ask: AskProjectHandler) {}

  async handle(ctx: AuthenticatedContext, input: { style: DraftStyle; projectId: string; instruction?: string | undefined; language?: string | undefined }): Promise<Result<CanvasDraft, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot draft text"));
    const gate = aiGate({ organisationEnabled: await this.setting.isEnabled(ctx.tenant.tenantId), providerConfigured: true, external: Boolean((ctx.tenant as { external?: boolean }).external), overCap: false });
    if (!gate.allowed) return ok({ available: false, reason: gate.reason === "NOT_FOR_PARTNERS" ? "Drafting is not available to outside partners." : "Drafting is not switched on for this organisation." });
    if (input.style === "QUESTION") {
      const question = input.instruction?.trim() ?? "";
      if (question.length < 3) return ok({ available: false, reason: "Write the question in the note first." });
      const asked = await this.ask.handle(ctx, input.projectId, question);
      if (!asked.ok) return asked;
      if (!asked.value.available) return ok({ available: false, reason: asked.value.reason });
      if (asked.value.answer.length === 0) return ok({ available: false, reason: "The project's records do not answer that." });
      return ok({ available: true, text: asked.value.answer.join(" "), dropped: asked.value.dropped.uncited + asked.value.dropped.ungrounded, note: ASK_NOTE });
    }
    const written = await this.writer.handle(ctx, input.projectId, input.language ? { language: input.language } : {});
    if (!written.ok) return written;
    if (!written.value.available) return ok({ available: false, reason: written.value.reason });
    const lines = (input.style === "SUMMARY" ? [...written.value.headlines.slice(0, 1), ...written.value.messages.slice(0, 2)] : written.value.messages.slice(0, 3)).map((x) => x.text);
    if (lines.length === 0) return ok({ available: false, reason: "Nothing the records support could be drafted." });
    return ok({ available: true, text: lines.join("\n"), dropped: written.value.droppedUngrounded, note: ASK_NOTE });
  }
}
