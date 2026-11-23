import { HEALTH_FACILITY_KIT } from "./kits/health-facility.js";
import type { FormKit } from "./kits/model.js";

export type { FormKit } from "./kits/model.js";

/** The ready-made forms. A kit is a row; nothing in the engine or the screens names one. */
export const FORM_KITS: readonly FormKit[] = [HEALTH_FACILITY_KIT];
export const formKitById = (id: string): FormKit | undefined => FORM_KITS.find((k) => k.id === id);
