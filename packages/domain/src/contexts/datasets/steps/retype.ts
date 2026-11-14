import type { StepDef } from "./types.js";
import { missing, str } from "./types.js";
import { isColumnKind, columnKind } from "../column-kinds.js";

/**
 * "Treat 'Month' as a month". The table keeps the cells as typed; the kind is applied when columns are confirmed (`applyKindOverrides`),
 * so a retype survives a refresh even when the guesser would answer differently next time.
 */
export const RETYPE: StepDef = {
  type: "RETYPE", label: "Treat a column as a type", phase: "TABLE",
  validate: (p, headers) => missing(headers, [str(p.column)]) ?? (isColumnKind(str(p.kind)) ? undefined : "Choose what the column holds."),
  apply: (t) => ({ ok: true, table: t }),
  kindOverride: (p) => (str(p.column) && isColumnKind(str(p.kind)) ? [str(p.column), str(p.kind)] : undefined),
  describe: (p) => `Treat '${str(p.column)}' as ${(columnKind(str(p.kind))?.label ?? str(p.kind)).toLowerCase()}`,
};
