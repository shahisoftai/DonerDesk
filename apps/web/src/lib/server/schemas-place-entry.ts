import { z } from "zod";

/** Phase 57: place-first entry and the by-place sheet. */
const PeriodChoice = z.object({ id: z.string(), label: z.string(), start: z.string(), end: z.string(), locked: z.boolean() });
const Split = z.object({ dimension: z.string(), category: z.string(), value: z.string() });
const Lock = z.enum(["VERIFIED", "CALCULATED", "PERIOD_LOCKED", "NOT_APPLICABLE"]).nullable();
const State = z.enum(["EMPTY", "DRAFT", "HANDED_IN", "RETURNED", "VERIFIED"]);

export const PlaceSheetResponseSchema = z.object({
  columns: z.array(z.object({ indicatorId: z.string(), code: z.string(), name: z.string(), type: z.string(), unit: z.string().nullable().optional(), adds: z.boolean(), lock: Lock, due: z.boolean() })),
  rows: z.array(z.object({ placeId: z.string(), name: z.string(), path: z.string(), level: z.number() })),
  cells: z.array(z.array(z.union([z.literal("NOT_MEASURED_HERE"), z.object({ value: z.string(), state: State, splits: z.array(Split) })]))),
  totals: z.array(z.string().nullable()),
  period: PeriodChoice,
  periods: z.array(PeriodChoice),
});
export type PlaceSheetResponse = z.infer<typeof PlaceSheetResponseSchema>;

export const PlaceCellsResponseSchema = z.object({ periodId: z.string(), saved: z.number(), notices: z.array(z.string()) });
export type PlaceCellsResponse = z.infer<typeof PlaceCellsResponseSchema>;

export const PlaceSheetImportResponseSchema = z.object({ changes: z.number(), unchanged: z.number(), problems: z.array(z.string()), applied: z.boolean(), notices: z.array(z.string()) });
export type PlaceSheetImportResponse = z.infer<typeof PlaceSheetImportResponseSchema>;
