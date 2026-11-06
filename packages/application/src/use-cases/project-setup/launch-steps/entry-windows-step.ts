import { entryWindowFor, ok } from "@donordesk/domain";
import type { ISetupLaunchStep, SetupEntryWindowWriter } from "../../../ports/project-setup-launch.js";

/** Gives every reporting period its entry window from the one rule the person set. A period that refuses is named, not fatal. */
export class EntryWindowsStep implements ISetupLaunchStep {
  readonly key = "ENTRY_WINDOWS";
  constructor(private readonly writer: SetupEntryWindowWriter) {}
  async run(...[ctx, projectId, draft]: Parameters<ISetupLaunchStep["run"]>) {
    const rule = draft.extras.collection.windowRule;
    if (!rule) return ok({ done: 0, notes: [] });
    const periods = await this.writer.periods(ctx, projectId);
    if (!periods.ok) return periods;
    if (periods.value.length === 0) return ok({ done: 0, notes: ["There are no reporting periods yet, so no entry windows were set. Set them when the periods exist."] });
    let done = 0;
    const notes: string[] = [];
    for (const period of periods.value) {
      const w = entryWindowFor(period.endDate, rule);
      const saved = await this.writer.setWindow(ctx, period.id, w);
      if (saved.ok) done += 1;
      else notes.push(`The period ending ${period.endDate.slice(0, 10)}: ${saved.error.message}`);
    }
    return ok({ done, notes });
  }
}
