import { ok } from "@donordesk/domain";
import type { ISetupLaunchStep, SetupReviewModeWriter } from "../../../ports/project-setup-launch.js";

/** Sets how values are checked: simple review when the person chose it, the full workflow otherwise. */
export class ReviewModeStep implements ISetupLaunchStep {
  readonly key = "REVIEW_MODE";
  constructor(private readonly writer: SetupReviewModeWriter) {}
  async run(...[ctx, projectId, draft]: Parameters<ISetupLaunchStep["run"]>) {
    const mode = draft.extras.collection.reviewMode;
    if (mode === undefined) return ok({ done: 0, notes: [] });
    const saved = await this.writer.handle(ctx, projectId, mode === "SIMPLE");
    return saved.ok ? ok({ done: 1, notes: [] }) : saved;
  }
}
