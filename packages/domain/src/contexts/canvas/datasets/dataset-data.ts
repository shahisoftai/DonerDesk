import type { DataSourceDef } from "../../visual-data/types.js";
import type { VisualRow } from "../../visual-data/shape.js";

/**
 * What a dataset block is given to resolve (Phase 54): the dataset's catalogue row and its rows, already narrowed by the viewer's
 * dataset filters and stripped of columns a share link may not show. Everything else (shaping, ranking, completeness) is done by the
 * block's own pure `resolve`, so the screen and a file draw the same thing.
 */
export interface DatasetBlockData {
  source: DataSourceDef;
  rows: VisualRow[];
  /** Rows in the dataset before the viewer's filters. */
  totalRows: number;
  /** Rows with an open data note (a check warning), counted for the note under the picture. */
  notedRows: number;
  /** Filters the viewer chose, as sentences ("Province: Sindh"). */
  filtered: string[];
  /** The places the rows matched and the areas above them, for a map (absent when the dataset has no place column). */
  places?: import("./data-visual-map.js").MapPlace[] | undefined;
  /** The project the dataset belongs to, so a map opens on its country. */
  projectId?: string | undefined;
}

export const NOT_READ = { state: "unavailable", reason: "The dataset is read when this is opened." } as const;

/** "Drawn from 1,204 rows; 12 have a data note" (§3.5). */
export function rowsNote(data: DatasetBlockData, used: number): string {
  const noted = data.notedRows > 0 ? `; ${data.notedRows.toLocaleString("en")} ${data.notedRows === 1 ? "has" : "have"} a data note` : "";
  const filtered = data.filtered.length ? ` (filtered: ${data.filtered.join("; ")})` : "";
  return `Drawn from ${used.toLocaleString("en")} ${used === 1 ? "row" : "rows"}${filtered}${noted}.`;
}
