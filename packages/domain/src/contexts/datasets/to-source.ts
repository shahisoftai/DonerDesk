import { columnKind } from "./column-kinds.js";
import type { DataSourceDef, FieldDef, JoinKey } from "../visual-data/types.js";
import type { ColumnDef, DatasetRowValues, DatasetSummary, SharePolicy } from "./model.js";
import { semanticOf } from "./semantics.js";
import type { VisualRow } from "../visual-data/shape.js";

/** The catalogue id of a dataset ("dataset:<id>"): datasets are sources like the built-in ones (§3.2). */
export const DATASET_SOURCE_PREFIX = "dataset:";
export const datasetSourceId = (datasetId: string): string => `${DATASET_SOURCE_PREFIX}${datasetId}`;
export const datasetIdOf = (sourceId: string): string | undefined => (sourceId.startsWith(DATASET_SOURCE_PREFIX) ? sourceId.slice(DATASET_SOURCE_PREFIX.length) : undefined);

/** Two extra fields every dataset carries: the resolved place and the period key, so maps and the period filter work on any dataset. */
export const PLACE_ID_FIELD = "_place_id";
export const PERIOD_KEY_FIELD = "_period";

/** A column a share link never shows: its meaning (partner, donor), money, or the person's own switch (§1.3). */
export function hiddenOnLinks(c: ColumnDef, policy?: SharePolicy): boolean {
  return c.hideOnShareLinks || semanticOf(c.semantic)?.shareable === false || columnKind(c.kind)?.money === true || Boolean(policy?.hidden.includes(c.key));
}

function fieldOfColumn(c: ColumnDef): FieldDef {
  const kind = columnKind(c.kind)!;
  const sem = semanticOf(c.semantic);
  return {
    id: c.key,
    label: c.label,
    meaning: sem && sem.key !== "NONE" ? `${sem.label}: ${c.sourceHeader}` : `From the column '${c.sourceHeader}'.`,
    role: kind.role === "GROUP" ? "DIMENSION" : "MEASURE",
    type: sem?.resolver === "PLACE" ? "PLACE" : kind.fieldType,
    ...(c.unit ? { unit: c.unit } : {}),
    ...(kind.role === "FIGURE" ? { additive: kind.additive } : {}),
    ...(kind.money ? { money: true } : {}),
    ...(sem?.joinKey ? { joinKey: sem.joinKey } : {}),
  };
}

/**
 * The catalogue row for a dataset (§3.2, the bridge into the existing Visual Studio). Every column becomes a field with its role,
 * type and additivity read from its kind; a dataset joins only on PROJECT (its place and period keys are its own, so mixing them with
 * indicator values through a join would compare unlike things). `guest` is false when the dataset is restricted, and a share link
 * still leaves out the hidden columns field by field (`guestColumns`).
 */
export function datasetToSource(ds: DatasetSummary, columns: readonly ColumnDef[]): DataSourceDef {
  const fields: FieldDef[] = columns.map(fieldOfColumn);
  if (columns.some((c) => semanticOf(c.semantic)?.resolver === "PLACE")) {
    fields.push({ id: PLACE_ID_FIELD, label: "Place (matched)", meaning: "The place in your places list the row's place was matched to.", role: "DIMENSION", type: "PLACE", joinKey: "PLACE" });
  }
  if (columns.some((c) => semanticOf(c.semantic)?.resolver === "PERIOD")) {
    fields.push({ id: PERIOD_KEY_FIELD, label: "Period", meaning: "The month, week or day of the row.", role: "DIMENSION", type: "DATE", joinKey: "PERIOD" });
  }
  const joins: JoinKey[] = ["PROJECT"];
  return {
    id: datasetSourceId(ds.id), label: ds.name, description: ds.description || "A table brought into DonorDesk.", grain: "a row of the dataset",
    permission: "project.view", guest: !ds.restricted, reader: "DatasetSourceReader", joins, fields,
  };
}

/** The rows a visual reads: the stored values plus the resolved place and period keys. A place nobody matched stays null, never guessed. */
export function datasetRowsToVisual(rows: readonly DatasetRowValues[]): VisualRow[] {
  return rows.map((r) => {
    const values: VisualRow["values"] = {};
    for (const [k, v] of Object.entries(r.values)) values[k] = typeof v === "boolean" ? (v ? "Yes" : "No") : v;
    values[PLACE_ID_FIELD] = r.placeId ?? null;
    values[PERIOD_KEY_FIELD] = r.periodKey ?? null;
    return { values };
  });
}

/** The columns a share link may read, in order. */
export const guestColumns = (columns: readonly ColumnDef[], policy?: SharePolicy): ColumnDef[] => columns.filter((c) => !hiddenOnLinks(c, policy));
