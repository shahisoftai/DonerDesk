/**
 * The window in which a period's values may be entered (Phase 33.4): optional, a plain opening day and/or closing day.
 * Outside it the people who enter values are refused (with the dates in the message); people who verify are not, so a
 * late figure can still be put in by a reviewer without reopening anything. No window means always open. Days are plain
 * (`YYYY-MM-DD`), compared as text; "today" is passed in. Pure.
 */
import { DomainError } from "../../core/domain-error.js";
import { err, ok, type Result } from "../../core/result.js";

export interface EntryWindow {
  opensOn?: string | undefined;
  closesOn?: string | undefined;
}

export type EntryWindowState = "OPEN" | "NOT_YET" | "CLOSED";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const isRealDay = (value: string): boolean => {
  if (!DAY.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
};

/** Both days are real days and the window does not close before it opens. Empty strings mean "not set". */
export function validateEntryWindow(input: { opensOn?: string | null | undefined; closesOn?: string | null | undefined }): Result<EntryWindow, DomainError> {
  const opensOn = input.opensOn?.trim() || undefined;
  const closesOn = input.closesOn?.trim() || undefined;
  if (opensOn && !isRealDay(opensOn)) return err(DomainError.validation("The opening day is not a date", { field: "opensOn" }));
  if (closesOn && !isRealDay(closesOn)) return err(DomainError.validation("The closing day is not a date", { field: "closesOn" }));
  if (opensOn && closesOn && closesOn < opensOn) return err(DomainError.validation("Entry cannot close before it opens", { field: "closesOn" }));
  return ok({ ...(opensOn ? { opensOn } : {}), ...(closesOn ? { closesOn } : {}) });
}

export function entryWindowState(window: EntryWindow, today: string): EntryWindowState {
  if (window.opensOn && today < window.opensOn) return "NOT_YET";
  if (window.closesOn && today > window.closesOn) return "CLOSED";
  return "OPEN";
}

const pretty = (day: string): string => {
  const [y, m, d] = day.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[(m ?? 1) - 1]} ${y}`;
};

/** The sentence shown to someone who may not enter values now (null when they may). */
export function entryWindowRefusal(window: EntryWindow, today: string): string | null {
  const state = entryWindowState(window, today);
  if (state === "OPEN") return null;
  return state === "NOT_YET"
    ? `Entry for this period opens on ${pretty(window.opensOn!)}. A reviewer can enter values before then.`
    : `Entry for this period closed on ${pretty(window.closesOn!)}. Ask a reviewer to enter the values or to change the closing day.`;
}

/** One line describing the window for the entry screen; null when there is none. */
export function describeEntryWindow(window: EntryWindow, today: string): string | null {
  if (!window.opensOn && !window.closesOn) return null;
  const state = entryWindowState(window, today);
  if (state === "NOT_YET") return `Entry opens on ${pretty(window.opensOn!)}${window.closesOn ? ` and closes on ${pretty(window.closesOn)}` : ""}.`;
  if (state === "CLOSED") return `Entry closed on ${pretty(window.closesOn!)}.`;
  return window.closesOn ? `Entry is open until ${pretty(window.closesOn)}.` : "Entry is open.";
}
