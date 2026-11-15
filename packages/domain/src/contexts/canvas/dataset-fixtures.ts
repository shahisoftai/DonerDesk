import { datasetRowsToVisual, datasetSourceId, datasetToSource } from "../datasets/to-source.js";
import type { ColumnDef, DatasetRowValues } from "../datasets/model.js";
import type { DatasetBlockData } from "./datasets/dataset-data.js";

/**
 * A small synthetic dataset for the dataset blocks' fixtures and tests (Phase 54): six districts in two provinces, four months, two
 * partners. Names are made up; no real data.
 */
const col = (key: string, label: string, kind: ColumnDef["kind"], semantic: ColumnDef["semantic"] = "NONE"): ColumnDef => ({ key, label, sourceHeader: label, kind, semantic, hideOnShareLinks: false });

export const FIXTURE_COLUMNS: readonly ColumnDef[] = [
  col("province", "Province", "TEXT", "PLACE"),
  col("district", "District", "TEXT", "PLACE"),
  col("month", "Month", "MONTH", "PERIOD"),
  col("partner", "Partner", "TEXT", "PARTNER"),
  col("screened", "Children screened", "COUNT"),
  col("admitted", "Admitted", "COUNT"),
  col("cured", "Cured", "COUNT"),
  col("exits", "Exits", "COUNT"),
  { ...col("cure_rate", "Cure rate", "RATE"), rateParts: { numerator: "cured", denominator: "exits", percent: true } },
];

const DISTRICTS = [["North", "Alder"], ["North", "Birch"], ["North", "Cedar"], ["South", "Dune"], ["South", "Elm"], ["South", "Fern"]] as const;
const MONTHS = ["2026-01", "2026-02", "2026-03", "2026-04"] as const;

export const FIXTURE_ROWS: readonly DatasetRowValues[] = DISTRICTS.flatMap(([province, district], d) => MONTHS.map((month, m) => {
  const exits = 40 + d * 5 + m * 3;
  const cured = Math.round(exits * (d % 2 === 0 ? 0.82 : 0.68));
  return {
    rowNo: d * MONTHS.length + m + 2, placeId: `pl-${district.toLowerCase()}`, periodKey: month,
    values: { province, district, month, partner: d % 2 === 0 ? "Partner A" : "Partner B", screened: 900 + d * 50 + m * 20, admitted: 60 + d * 4 + m, cured, exits, cure_rate: Math.round((cured / exits) * 1000) / 10 },
  };
}));

export const FIXTURE_DATASET_ID = "fixture-nutrition";
export const FIXTURE_SOURCE_ID = datasetSourceId(FIXTURE_DATASET_ID);

export function fixtureDatasetData(): DatasetBlockData {
  return { source: datasetToSource({ id: FIXTURE_DATASET_ID, name: "Monthly programme data", description: "", scope: "PROJECT", restricted: false }, FIXTURE_COLUMNS), rows: datasetRowsToVisual(FIXTURE_ROWS), totalRows: FIXTURE_ROWS.length, notedRows: 0, filtered: [] };
}
