import type { SetupAreaKey } from "@donordesk/domain";
import type { ISetupAreaApplier } from "../../ports/project-setup.js";

/** Appliers by area; the handlers never name an area, they look it up here. */
export const appliersByArea = (appliers: ReadonlyArray<ISetupAreaApplier>): ReadonlyMap<SetupAreaKey, ISetupAreaApplier> =>
  new Map(appliers.map((a) => [a.area, a]));
