import { ok } from "@donordesk/domain";
import type { ISetupLaunchStep, SetupProjectActivator } from "../../../ports/project-setup-launch.js";

/**
 * The last step: the project becomes active. It comes after every other step, so a launch that stopped partway leaves a draft,
 * which the product already shows as "not started yet". A project that is already active stays so.
 */
export class ActivationStep implements ISetupLaunchStep {
  readonly key = "ACTIVATION";
  constructor(private readonly activator: SetupProjectActivator) {}
  async run(...[ctx, projectId]: Parameters<ISetupLaunchStep["run"]>) {
    const done = await this.activator.activate(ctx, projectId);
    return done.ok ? ok({ done: 1, notes: [] }) : done;
  }
}
