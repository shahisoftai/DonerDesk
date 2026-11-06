"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SetupApplyResult, SetupProposalView } from "@/lib/server/schemas-project-setup";
import type { SetupCopy } from "../copy";
import { buildDeck, lockReason, neighbour, openingSlide, slideAt, stepCount, type DeckSlide } from "../domain/slide-deck";
import { AreaSlide } from "./AreaSlide";
import { CreateSlide } from "./CreateSlide";
import { DoneSlide } from "./DoneSlide";
import { GuideSlide } from "./GuideSlide";
import { ReadingSlide } from "./ReadingSlide";
import { SlideFrame, type FrameNav } from "./SlideFrame";
import { StepRail, railLabel } from "./StepRail";
import { useSetupCopy } from "./useSetupCopy";
import { UploadSlide, type RecentSetup } from "./UploadSlide";

/** What a slide says in its header band. */
function headerFor(slide: DeckSlide, total: number, c: SetupCopy, view: SetupProposalView | null, result: SetupApplyResult | null) {
  const eyebrow = slide.step ? c.nav.stepOf(slide.step, total) : slide.kind === "done" ? c.nav.finished : c.welcome.eyebrow;
  switch (slide.kind) {
    case "guide": return { eyebrow, title: c.welcome.title, lead: c.welcome.lead };
    case "upload": return { eyebrow, title: c.upload.title, lead: c.upload.lead };
    case "reading": {
      const s = view?.proposal.status;
      return s === "FAILED" ? { eyebrow, title: c.reading.failedTitle, lead: c.reading.failedLead }
        : s && s !== "EXTRACTING" ? { eyebrow, title: c.reading.doneTitle, lead: c.reading.doneLead } : { eyebrow, title: c.reading.title, lead: c.reading.lead };
    }
    case "area": return { eyebrow, title: c.areas[slide.area!].title, lead: c.areas[slide.area!].lead };
    case "create": return { eyebrow, title: c.create.title, lead: c.create.lead };
    case "done": return result?.status === "PARTIAL" ? { eyebrow, title: c.done.partial, lead: c.done.partialLead } : { eyebrow, title: c.done.title, lead: c.done.lead };
  }
}

/**
 * The project setup wizard as a deck of slides. It owns only which slide is open and which way the person is travelling;
 * what each slide says and when it is open come from the pure deck and copy, and what each slide does is its own component.
 */
export function SetupWizard({ view, recent, asked }: { view: SetupProposalView | null; recent: RecentSetup[]; asked: string | null }) {
  const { c, dir } = useSetupCopy();
  const deck = useMemo(buildDeck, []);
  const total = stepCount(deck);
  const status = view?.proposal.status ?? null;
  const [result, setResult] = useState<SetupApplyResult | null>(null);
  const applied = result !== null;
  const decided = useMemo(() => new Set((view?.areas ?? []).filter((a) => a.accepted > 0).map((a) => a.area.toLowerCase())), [view]);
  const [current, setCurrent] = useState(() => openingSlide(deck, asked, status, false));
  const [direction, setDirection] = useState<"forward" | "back">("forward");

  const go = useCallback((key: string) => {
    const target = slideAt(deck, key);
    if (lockReason(target, status, applied) !== null) return;
    const from = deck.findIndex((s) => s.key === current);
    setDirection(deck.findIndex((s) => s.key === key) < from ? "back" : "forward");
    setCurrent(key);
    window.history.replaceState(null, "", `${window.location.pathname}?s=${encodeURIComponent(key)}`);
  }, [deck, status, applied, current]);

  // A slide that closes under the person (the document turned out unreadable) moves them to where they can act.
  useEffect(() => {
    if (lockReason(slideAt(deck, current), status, applied) !== null) setCurrent(openingSlide(deck, null, status, applied));
  }, [deck, current, status, applied]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      // The arrow that points the way the language reads moves forward: → in English, ← in Arabic.
      const forward = dir === "rtl" ? e.key === "ArrowLeft" : e.key === "ArrowRight";
      const n = neighbour(deck, current, forward ? 1 : -1);
      if (n && lockReason(n, status, applied) === null) go(n.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deck, current, status, applied, go, dir]);

  const slide = slideAt(deck, current);
  const prev = neighbour(deck, current, -1);
  const next = neighbour(deck, current, 1);
  const nav = (n: DeckSlide | undefined, verb: "Back" | "Next"): FrameNav | undefined =>
    n ? { label: verb === "Back" ? c.nav.back : c.nav.nextTo(railLabel(n, c)), onClick: () => go(n.key), disabled: lockReason(n, status, applied) !== null, reason: lockReason(n, status, applied) } : undefined;
  const head = headerFor(slide, total, c, view, result);
  const showNext = slide.kind === "area" || (slide.kind === "upload" && status !== null);
  const showBack = slide.kind !== "guide" && slide.kind !== "done";

  return (
    // The portal shell already provides the page's one main landmark.
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[230px_minmax(0,1fr)]">
      <div className="lg:sticky lg:top-6 lg:self-start">
        <StepRail deck={deck} current={current} status={status} applied={applied} decided={decided} onOpen={go} />
      </div>
      <div>
        <p aria-live="polite" className="sr-only">{head.eyebrow}: {head.title}</p>
        <SlideFrame
          slideKey={current}
          direction={direction}
          eyebrow={head.eyebrow}
          title={head.title}
          lead={head.lead}
          back={showBack ? nav(prev, "Back") : undefined}
          next={showNext ? nav(next, "Next") : undefined}
          nextTone="primary"
        >
          {slide.kind === "guide" && <GuideSlide onStart={() => go("document")} />}
          {slide.kind === "upload" && <UploadSlide recent={recent} />}
          {slide.kind === "reading" && <ReadingSlide view={view} onNext={() => go(deck.find((s) => s.kind === "area")!.key)} onBackToDocument={() => go("document")} />}
          {slide.kind === "area" && view && <AreaSlide view={view} area={slide.area!} />}
          {slide.kind === "create" && view && <CreateSlide view={view} result={result} onApplied={(r) => { setResult(r); setDirection("forward"); setCurrent("done"); window.history.replaceState(null, "", `${window.location.pathname}?s=done`); }} />}
          {slide.kind === "done" && <DoneSlide projectId={result?.projectId ?? view?.proposal.appliedProjectId} result={result} />}
        </SlideFrame>
        <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">{c.nav.keysTip(total)}</p>
      </div>
    </div>
  );
}
