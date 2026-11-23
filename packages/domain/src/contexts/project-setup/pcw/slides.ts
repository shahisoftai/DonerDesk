/**
 * The ten slides of the Project Creation Wizard (Phase 38): one exhaustive table (open/closed). A slide is a decision a person
 * makes, not a kind of data; each owns the requirements that must hold before Launch. No code outside this table branches on a
 * slide name — order, labels and dependencies are read from here.
 */
export const SLIDE_KEYS = [
  "START", "PROJECT_TEAM", "RESULTS", "INDICATORS", "PLACES", "WORK_PLAN", "DATA_ENTRY", "REPORTING", "FINANCE", "LAUNCH",
] as const;

export type SlideKey = (typeof SLIDE_KEYS)[number];

export interface SlideDef {
  key: SlideKey;
  /** 1 is shown first; the order a person is guided through, not a restriction (any slide can be opened). */
  order: number;
  /** i18n key; the web catalogue translates it (`pcw.slide.<key>`). */
  labelKey: string;
  /** Slides whose answers this one reads; the guide suggests them first. */
  dependsOn: readonly SlideKey[];
  /**
   * Phase 65: an essential slide holds what the first period's figures and report cannot be right without. The others "can wait": the
   * wizard offers "Finish later on the project" and the project's setup checklist carries them after launch.
   */
  essential: boolean;
}

export const SETUP_SLIDES: Record<SlideKey, SlideDef> = {
  START: { key: "START", essential: true, order: 1, labelKey: "pcw.slide.start", dependsOn: [] },
  PROJECT_TEAM: { key: "PROJECT_TEAM", essential: true, order: 2, labelKey: "pcw.slide.projectTeam", dependsOn: ["START"] },
  RESULTS: { key: "RESULTS", essential: true, order: 3, labelKey: "pcw.slide.results", dependsOn: ["PROJECT_TEAM"] },
  INDICATORS: { key: "INDICATORS", essential: true, order: 4, labelKey: "pcw.slide.indicators", dependsOn: ["RESULTS", "PROJECT_TEAM"] },
  PLACES: { key: "PLACES", essential: false, order: 5, labelKey: "pcw.slide.places", dependsOn: ["START"] },
  WORK_PLAN: { key: "WORK_PLAN", essential: false, order: 6, labelKey: "pcw.slide.workPlan", dependsOn: ["RESULTS", "INDICATORS", "PLACES", "PROJECT_TEAM"] },
  DATA_ENTRY: { key: "DATA_ENTRY", essential: false, order: 7, labelKey: "pcw.slide.dataEntry", dependsOn: ["INDICATORS", "WORK_PLAN"] },
  REPORTING: { key: "REPORTING", essential: true, order: 8, labelKey: "pcw.slide.reporting", dependsOn: ["START", "PROJECT_TEAM"] },
  FINANCE: { key: "FINANCE", essential: false, order: 9, labelKey: "pcw.slide.finance", dependsOn: ["WORK_PLAN"] },
  LAUNCH: { key: "LAUNCH", essential: true, order: 10, labelKey: "pcw.slide.launch", dependsOn: ["START", "PROJECT_TEAM", "RESULTS", "INDICATORS", "PLACES", "WORK_PLAN", "DATA_ENTRY", "REPORTING", "FINANCE"] },
};

/** The slides in guided order, independent of key order. */
export const SLIDE_ORDER: readonly SlideKey[] = [...SLIDE_KEYS].sort((a, b) => SETUP_SLIDES[a].order - SETUP_SLIDES[b].order);

/** Slides that hold only what can wait until after launch, in guided order. */
export const SLIDES_THAT_CAN_WAIT: readonly SlideKey[] = SLIDE_ORDER.filter((k) => !SETUP_SLIDES[k].essential);
