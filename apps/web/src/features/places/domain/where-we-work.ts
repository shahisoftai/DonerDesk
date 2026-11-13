/**
 * The tabs of the project's "Where we work" page (Phase 53.4). One table; an unknown address falls back to the first tab. Pure.
 * Port for the place picker (so the wizard's draft and this page can share one component): three small methods, as the plan asks.
 */
export type WhereTab = "areas" | "points" | "confirm";
export const WHERE_WE_WORK_TABS: ReadonlyArray<{ key: WhereTab; label: string }> = [
  { key: "areas", label: "Areas" },
  { key: "points", label: "Points" },
  { key: "confirm", label: "To confirm" },
];
export const tabOf = (value: string | undefined): WhereTab => WHERE_WE_WORK_TABS.find((t) => t.key === value)?.key ?? "areas";

export interface PlaceSelectionPort {
  load(): Promise<ReadonlyArray<{ ref: string; ticked: boolean }>>;
  tick(ref: string): Promise<void>;
  untick(ref: string): Promise<void>;
}
