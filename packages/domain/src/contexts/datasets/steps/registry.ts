import { APPEND } from "./append.js";
import { DROP_COLUMNS } from "./drop-columns.js";
import { FILL_DOWN } from "./fill-down.js";
import { KEEP_ROWS_WHERE } from "./keep-rows.js";
import { MAP_VALUES } from "./map-values.js";
import { RENAME } from "./rename.js";
import { RETYPE } from "./retype.js";
import { HEADER_ROW, USE_SHEET } from "./source-steps.js";
import { SPLIT } from "./split.js";
import type { StepDef } from "./types.js";
import { UNPIVOT } from "./unpivot.js";

/** The tidy steps (§3.4): a small, fixed Power Query. A new step is a new file and a row here; `applySteps` is untouched. */
export const STEP_DEFS: readonly StepDef[] = [USE_SHEET, HEADER_ROW, RENAME, RETYPE, DROP_COLUMNS, KEEP_ROWS_WHERE, FILL_DOWN, UNPIVOT, SPLIT, MAP_VALUES, APPEND];
const BY_TYPE = new Map(STEP_DEFS.map((s) => [s.type, s]));
export const stepDef = (type: string): StepDef | undefined => BY_TYPE.get(type);
