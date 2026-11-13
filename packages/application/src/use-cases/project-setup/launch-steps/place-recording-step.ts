import { ok, placeRecordingForLaunch } from "@donordesk/domain";
import type { ISetupLaunchStep, SetupPlaceRecordingWriter } from "../../../ports/project-setup-launch.js";

/** When places were ticked, the countable indicators the launch made are recorded by place, so the map has figures to draw. Safe to run again. */
export class PlaceRecordingStep implements ISetupLaunchStep {
  readonly key = "PLACE_RECORDING";
  constructor(private readonly writer: SetupPlaceRecordingWriter) {}
  async run(...[ctx, projectId, draft]: Parameters<ISetupLaunchStep["run"]>) {
    const plan = placeRecordingForLaunch(draft);
    if (plan.level === null || plan.codes.length === 0) return ok({ done: 0, notes: [] });
    const r = await this.writer.recordByPlace(ctx, projectId, plan.codes, plan.level);
    return r.ok ? ok({ done: r.value.changed, notes: r.value.notes }) : r;
  }
}
