/**
 * The wizard as a deck of slides (Phase 36.6), pure: which slides exist and in what order, which one opens first, and which
 * are locked until the step before them is done. The screens only draw it. The areas come from the contracts' list, so a new
 * setup area is one more slide with no other change here.
 */
import { SETUP_AREA_KEYS } from "@donordesk/contracts";

export type AreaKey = (typeof SETUP_AREA_KEYS)[number];
export type SlideKind = "guide" | "upload" | "reading" | "area" | "create" | "done";
export type ProposalStatus = "EXTRACTING" | "READY" | "APPLYING" | "APPLIED" | "PARTIAL" | "FAILED" | "DISCARDED";

export interface DeckSlide {
  key: string;
  kind: SlideKind;
  area?: AreaKey;
  /** The number shown as "Step n"; the welcome and the finish are not numbered steps. */
  step: number | null;
}

export function buildDeck(): DeckSlide[] {
  const head: DeckSlide[] = [
    { key: "welcome", kind: "guide", step: null },
    { key: "document", kind: "upload", step: 1 },
    { key: "reading", kind: "reading", step: 2 },
  ];
  const areas = SETUP_AREA_KEYS.map((area, i): DeckSlide => ({ key: area.toLowerCase(), kind: "area", area, step: 3 + i }));
  const tail: DeckSlide[] = [
    { key: "create", kind: "create", step: 3 + SETUP_AREA_KEYS.length },
    { key: "done", kind: "done", step: null },
  ];
  return [...head, ...areas, ...tail];
}

export const stepCount = (deck: ReadonlyArray<DeckSlide>): number => deck.filter((s) => s.step !== null).length;

const REVIEWABLE: ReadonlySet<string> = new Set(["READY", "PARTIAL", "APPLIED"]);

/** Why a slide cannot be opened yet, in a sentence, or null when it can. */
export function lockReason(slide: DeckSlide, status: ProposalStatus | null, applied: boolean): string | null {
  switch (slide.kind) {
    case "guide":
    case "upload":
      return null;
    case "reading":
      return status === null ? "Add your document first." : null;
    case "area":
    case "create":
      // While the project is being created the Create slide stays open and shows the progress; nothing else is.
      if (slide.kind === "create" && status === "APPLYING") return null;
      if (status === null) return "Add your document first.";
      if (status === "EXTRACTING") return "DonorDesk is still reading your document.";
      if (status === "FAILED" || status === "DISCARDED") return "This document could not be read. Go back and add it again.";
      return REVIEWABLE.has(status) ? null : "Not available yet.";
    case "done":
      return applied || status === "APPLIED" ? null : "Create the project first.";
  }
}

/** The slide to open: the one asked for if it exists and is open, otherwise where the person's progress puts them. */
export function openingSlide(deck: ReadonlyArray<DeckSlide>, asked: string | null | undefined, status: ProposalStatus | null, applied: boolean): string {
  const open = (key: string) => {
    const slide = deck.find((s) => s.key === key);
    return slide !== undefined && lockReason(slide, status, applied) === null;
  };
  if (asked && open(asked)) return asked;
  if (status === null) return "welcome";
  if (status === "EXTRACTING" || status === "FAILED" || status === "DISCARDED") return "reading";
  if (status === "APPLIED") return "done";
  return deck.find((s) => s.kind === "area")!.key;
}

export const slideAt = (deck: ReadonlyArray<DeckSlide>, key: string): DeckSlide => deck.find((s) => s.key === key) ?? deck[0]!;

export function neighbour(deck: ReadonlyArray<DeckSlide>, key: string, direction: 1 | -1): DeckSlide | undefined {
  const index = deck.findIndex((s) => s.key === key);
  return index === -1 ? undefined : deck[index + direction];
}

/** 0–100, for the progress bar: how far through the deck the open slide is. */
export function progressPercent(deck: ReadonlyArray<DeckSlide>, key: string): number {
  const index = Math.max(0, deck.findIndex((s) => s.key === key));
  return Math.round((index / Math.max(1, deck.length - 1)) * 100);
}
