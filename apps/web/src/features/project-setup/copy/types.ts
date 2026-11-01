/**
 * Everything the setup wizard says, as one typed shape (Phase 36). `en` is the source; `fr`, `es` and `ar` are typed against
 * this interface, so a missing or extra string in any language is a compile error. Wording that carries a number or a name is a
 * function (the caller formats numbers for the language); nothing is built by joining translated pieces.
 */
import type { SETUP_AREA_KEYS } from "@donordesk/contracts";

export type AreaKey = (typeof SETUP_AREA_KEYS)[number];
export type ProblemCode =
  | "FACTS_NAME_REQUIRED" | "LOGFRAME_CYCLE" | "LOGFRAME_PARENT_UNKNOWN" | "LOGFRAME_DUPLICATE_CODE" | "INDICATOR_DUPLICATE_CODE"
  | "INDICATOR_LOGFRAME_UNKNOWN" | "END_BEFORE_START" | "PERIOD_OUTSIDE_DATES" | "ACTIVITY_OUTSIDE_DATES" | "CURRENCY_NOT_STATED";

/** A number as the caller wrote it for the language (already formatted), or a plain number. */
export type Count = number | string;

export interface Option { label: string; text: string }
export interface Titled { title: string; text: string }

export interface Guidance {
  /** The rail's short name for the step. */
  short: string;
  title: string;
  lead: string;
  checks: string[];
  dos: string[];
  donts: string[];
  options: Option[];
  tip: string;
}

export type FieldKey = "title" | "projectCode" | "donorName" | "implementingOrganization" | "country" | "sector" | "startDate" | "endDate" | "reportingFrequency";

export interface SetupCopy {
  nav: { back: string; nextTo: (label: string) => string; stepOf: (n: number, total: number) => string; finished: string; keysTip: (total: number) => string };
  rail: { title: string; progress: string; current: string; done: string; locked: string };
  common: { do: string; dont: string; whatToCheck: string; yourOptions: string; tip: string; instructions: string; unknownError: string; stale: string };
  welcome: {
    short: string; eyebrow: string; title: string; lead: string; time: string;
    howTitle: string; how: Titled[]; youGetTitle: string; youGet: string[]; wontDoTitle: string; wontDo: string[];
    dos: string[]; donts: string[]; privacy: string; start: string;
  };
  upload: {
    short: string; title: string; lead: string; formatsTitle: string; formats: Array<{ name: string; note: string }>;
    dos: string[]; donts: string[]; options: Option[]; tip: string; where: string;
    button: string; busy: string; drop: string; chooseFiles: string; addFiles: string; removeFile: (name: string) => string;
    filesOf: (n: Count, max: Count) => string; sizeKb: (kb: string) => string; pasteLabel: string; tabsLabel: string;
    recentTitle: string; noRecent: string; sendError: string; recentStatus: Record<string, string>;
  };
  reading: {
    short: string; title: string; lead: string; tips: string[]; whileWait: string; doneTitle: string; doneLead: string;
    failedTitle: string; failedLead: string; failedFallback: string; failedOptions: Option[]; partial: string; partialHelp: string;
    next: string; addAgain: string; addFirst: string; progressLabel: string; partsLabel: string;
    state: { WAITING: string; RUNNING: string; FINISHED: string; FAILED: string; NOT_READ: string };
    reading: (done: Count, total: Count) => string; found: (n: Count) => string; partlyRead: string;
    readAgain: string; readingAgain: string;
    partlyReadEmpty: string; elapsed: (time: string) => string; stoppedHint: string;
    usage: (requests: string, tokens: string) => string; usageCost: (cost: string) => string; usageUnpriced: string;
  };
  areas: Record<AreaKey, Guidance>;
  review: {
    counts: (accepted: number, pending: number, total: number) => string; acceptAll: (n: number) => string;
    readAgain: string; readAgainYes: string; readAgainKeep: string; readAgainNote: string;
    levels: Record<string, string>;
    accept: string; reject: string; writeOwn: string; save: string; cancel: string; from: string; notStated: string; noItems: string;
    status: { PROPOSED: string; ACCEPTED: string; REJECTED: string; EDITED: string; NOT_IN_DOCUMENT: string };
    confidence: { HIGH: string; MEDIUM: string; LOW: string };
    fieldHeadings: Record<string, string>; factLabels: Record<string, string>; untitled: (field: string, n: number) => string;
    problems: Record<ProblemCode, (p: Record<string, string | number>) => string>;
  };
  create: {
    short: string; title: string; lead: string; checks: string[]; dos: string[]; donts: string[]; options: Option[]; tip: string;
    creatingNote: string; creatingProgress: (done: Count, total: Count) => string;
    partsTitle: string; detailsTitle: string; createButton: string; resumeButton: string; working: string; previewButton: string; previewing: string;
    leftOut: string; nothingLeftOut: string; theProject: string; nothingAccepted: string; accepted: (n: number) => string; choose: string;
    blocking: string; missing: string; viewProject: string;
    fields: Record<FieldKey, string>; sectors: Record<string, string>; frequencies: Record<string, string>;
  };
  done: {
    short: string; title: string; lead: string; partial: string; partialLead: string; createdDraft: string;
    next: Array<{ title: string; text: string; cta: string }>; another: string;
    documentIn: string; documentMoved: (folder: string) => string; documentOpen: string; documentsIn: string;
    areaCouldNot: string; areaCreated: (n: Count) => string; areaThere: string; areaDone: string;
  };
}
