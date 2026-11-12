import { ok, presetVocabulary } from "@donordesk/domain";
import type { ISetupLaunchStep, SetupVocabularyWriter } from "../../../ports/project-setup-launch.js";

/** Saves the donor wording the person chose for the levels of the results framework; nothing chosen = the default words stay. */
export class WordingStep implements ISetupLaunchStep {
  readonly key = "WORDING";
  constructor(private readonly writer: SetupVocabularyWriter) {}
  async run(...[ctx, projectId, draft]: Parameters<ISetupLaunchStep["run"]>) {
    const choice = draft.extras.start.wording;
    const vocabulary = choice ? presetVocabulary(choice) : undefined;
    if (!vocabulary) return ok({ done: 0, notes: [] });
    const saved = await this.writer.handle(ctx, projectId, vocabulary);
    return saved.ok ? ok({ done: 1, notes: [] }) : saved;
  }
}
