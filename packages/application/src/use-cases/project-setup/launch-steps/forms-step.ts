import { ok, willApplyItem } from "@donordesk/domain";
import type { ISetupLaunchStep, SetupFormWriter } from "../../../ports/project-setup-launch.js";

/** Drafts a collection form for each indicator collected by a form. Drafts only: nothing is published. A refusal is a note. */
export class FormsStep implements ISetupLaunchStep {
  readonly key = "FORMS";
  constructor(private readonly writer: SetupFormWriter) {}
  async run(...[ctx, projectId, draft]: Parameters<ISetupLaunchStep["run"]>) {
    const wanted = draft.proposal.indicators.filter((i) => willApplyItem(i) && i.value?.code && draft.extras.indicatorSetup[i.value.code]?.method === "FORM").map((i) => i.value!.code as string);
    if (wanted.length === 0) return ok({ done: 0, notes: [] });
    const ids = await this.writer.indicatorIds(ctx, projectId);
    if (!ids.ok) return ids;
    let done = 0;
    const notes: string[] = [];
    for (const code of wanted) {
      const id = ids.value.get(code);
      if (!id) { notes.push(`${code}: the indicator was not found in the project, so no form was drafted.`); continue; }
      const made = await this.writer.createDraft(ctx, id);
      if (made.ok) done += 1;
      else notes.push(`${code}: ${made.error.message}`);
    }
    return ok({ done, notes });
  }
}
