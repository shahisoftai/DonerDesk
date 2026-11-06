/**
 * The other things the Record forms ask of the app besides reading and writing records (Phase 44): what to do when a day lands in no
 * reporting period, and the facts about a project that change the words on a button. Small interfaces, so a form depends only on
 * the one it needs; the offline field page supplies versions that answer "not now" instead of calling the server.
 */
import type { PeriodProposal } from "@donordesk/domain/contexts/reporting/period-for-date-proposal.js";

export type ServiceResult = { ok: true } | { ok: false; message: string };

export interface PeriodOpener {
  /** What would be opened for this day, or null when it cannot be known now (no connection). */
  proposal(projectId: string, date: string): Promise<PeriodProposal | null>;
  /** A manager opens the period(s) the project's schedule calls for. */
  open(projectId: string, date: string): Promise<ServiceResult>;
  /** Anyone else asks the project manager to. */
  ask(projectId: string, date: string): Promise<ServiceResult>;
}

export interface ProjectFacts {
  /** The project hands values in as they are saved (only the button's words change in the form; the server decides the rest). */
  simpleReview(projectId: string): Promise<boolean>;
}
