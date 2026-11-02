import type { Sector, SlideKey } from "@donordesk/domain";
import type { SetupDraftView, SetupResultView } from "../../../../lib/server/schemas-project-setup-draft.ts";
import { PCW_COPY, REQUIREMENT_SENTENCES, type PcwSentences } from "../copy.ts";

/** The sectors a project can be filed under, in the order they are offered (kept in step with the identity context's list by a type check). */
export const SECTOR_OPTIONS = ["NUTRITION", "FOOD_SECURITY", "WASH", "HEALTH", "PROTECTION", "EDUCATION", "LIVELIHOODS", "SHELTER", "MULTI_SECTOR", "OTHER"] as const satisfies readonly Sector[];

export interface RailEntry {
  slide: SlideKey;
  open: number;
  complete: boolean;
  /** The words under the slide's name; never only a colour. */
  status: string;
}

/** The rail of slides in the order the API gave them, each with its progress in words. */
export function railEntries(view: SetupDraftView, progress: (open: number) => string = PCW_COPY.progress): RailEntry[] {
  return view.progress.map((p) => ({ slide: p.slide, open: p.open, complete: p.complete, status: progress(p.open) }));
}

/** The plain sentence for one open requirement. */
export function sentenceFor(result: SetupResultView, sentences: PcwSentences = REQUIREMENT_SENTENCES): string {
  return result.code ? sentences[result.code](result.params ?? {}) : "";
}

/** What is still to answer on one slide, as sentences. */
export function slideGaps(view: SetupDraftView, slide: SlideKey, sentences: PcwSentences = REQUIREMENT_SENTENCES): Array<{ key: string; text: string }> {
  return view.inbox.filter((r) => r.slide === slide).map((r) => ({ key: r.key, text: sentenceFor(r, sentences) }));
}

/** The first slide that still has something to answer, else the last one (Launch). */
export function firstOpenSlide(view: SetupDraftView): SlideKey {
  return (view.progress.find((p) => !p.complete) ?? view.progress[view.progress.length - 1])!.slide;
}

export function neighbourSlide(view: SetupDraftView, slide: SlideKey, step: 1 | -1): SlideKey | null {
  const i = view.progress.findIndex((p) => p.slide === slide);
  return view.progress[i + step]?.slide ?? null;
}

/** Whether the person answered this requirement "not used", and why (the reason is optional). */
export function notUsedAnswer(view: SetupDraftView, requirement: string): { notUsed: boolean; reason: string } {
  const answer = view.extras.answers[requirement];
  return { notUsed: answer?.notUsed === true, reason: answer?.reason ?? "" };
}
