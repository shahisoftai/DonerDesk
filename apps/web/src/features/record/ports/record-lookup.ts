/**
 * What the Record forms read (Phase 44), as small interfaces so a form depends only on what it uses: a number form never sees the plan,
 * a form filler never sees indicators. Two adapters satisfy them (the network and the offline pack) and a shared test holds both to
 * the same answers, so a form behaves the same online and with no signal.
 *
 * A part the source does not carry (a v1 pack, an older server) is `null`, never an empty list: "none" and "not on this phone" are
 * different sentences for the person.
 */
import type { PackEntryPlace, PackForm, PackIndicator, PackIndicatorPlace, PackPeriod, PackPlace, PackPlanItem } from "../../offline/domain/offline-pack.ts";

export interface RecordProject { id: string; name: string }

export interface ProjectLookup { projects(): Promise<RecordProject[]> }
export interface IndicatorLookup { indicators(projectId: string): Promise<PackIndicator[] | null> }
export interface PeriodLookup { periods(projectId: string): Promise<PackPeriod[] | null> }
export interface PlanLookup { plan(projectId: string): Promise<PackPlanItem[] | null> }
export interface PlaceLookup { places(projectId: string): Promise<PackPlace[]> }
export interface FormLookup { forms(projectId: string): Promise<PackForm[]> }

/** Place-first entry (Phase 57): where a person can start, and where each indicator is measured. null = not on this phone. */
export interface PlaceEntryLookup {
  placeEntry(projectId: string): Promise<{ places: PackEntryPlace[]; indicatorPlaces: PackIndicatorPlace[] } | null>;
  /** The current figures of one place in one period. null = not on this phone (an older period, or an older pack). */
  placeCells(projectId: string, periodId: string, placeId: string): Promise<Array<{ indicatorId: string; value: string; locked: boolean; lockReason?: string }> | null>;
}

export interface RecordLookup extends ProjectLookup, IndicatorLookup, PeriodLookup, PlanLookup, PlaceLookup, FormLookup, PlaceEntryLookup {
  readonly source: "network" | "pack";
  /**
   * Forget what was read for a project so the next ask reads it again (a manager just opened a period). The pack on a phone cannot
   * change by itself, so for it this does nothing; the network source drops its copy.
   */
  refresh(projectId: string): void;
}
