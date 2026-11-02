"use client";

import { useEffect, useState } from "react";
import type { SlideKey } from "@donordesk/domain";
import { SlideFrame } from "../../presentation/SlideFrame";
import type { SetupDraftView } from "@/lib/server/schemas-project-setup-draft";
import { usePcwCopy } from "./usePcwCopy";
import { getDraftAction } from "@/lib/actions/project-setup-draft";
import { READING_POLL_MS, readingState } from "../domain/documents-view";
import { firstOpenSlide, neighbourSlide, railEntries, slideGaps } from "../domain/pcw-view";
import { anyAreaRunning } from "../domain/parity-view";
import { DocumentsList } from "./DocumentsList";
import { LeftOutNote } from "./LeftOutNote";
import { RereadPart } from "./RereadPart";
import { GapInbox } from "./GapInbox";
import { DataEntrySlide } from "./DataEntrySlide";
import { FinanceSlide } from "./FinanceSlide";
import { IndicatorsSlide } from "./IndicatorsSlide";
import { LaunchSlide } from "./LaunchSlide";
import { PlacesSlide } from "./PlacesSlide";
import { ProjectTeamSlide } from "./ProjectTeamSlide";
import { ReportingSlide } from "./ReportingSlide";
import { ResultsSlide } from "./ResultsSlide";
import { WorkPlanSlide } from "./WorkPlanSlide";
import { StartSlide } from "./StartSlide";

/**
 * The ten-slide wizard shell (Phase 38). It owns only which slide is open; each slide's rules and sentences come from the
 * domain through the API, so the shell holds no requirement of its own. Slides not yet built show what is still to answer
 * there, so the whole list is visible from the start.
 */
export function PcwShell({ id, initial }: { id: string; initial: SetupDraftView }) {
  const pcw = usePcwCopy();
  const PCW_COPY = pcw.c;
  const PCW_SLIDES = pcw.slides;
  const [view, setView] = useState(initial);
  const [current, setCurrent] = useState<SlideKey>(() => firstOpenSlide(initial));
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const reading = readingState(view);
  const rereading = anyAreaRunning(view);
  // While documents are being read the page asks again, and shows what was found as soon as it is ready.
  useEffect(() => {
    if (reading !== "READING" && !rereading) return;
    const timer = setInterval(() => { void getDraftAction(id).then((r) => { if (r.ok) setView(r.value); }); }, READING_POLL_MS);
    return () => clearInterval(timer);
  }, [reading, rereading, id]);
  const rail = railEntries(view, PCW_COPY.progress);
  const go = (slide: SlideKey) => {
    setDirection(rail.findIndex((r) => r.slide === slide) < rail.findIndex((r) => r.slide === current) ? "back" : "forward");
    setCurrent(slide);
  };
  const prev = neighbourSlide(view, current, -1);
  const next = neighbourSlide(view, current, 1);
  const index = rail.findIndex((r) => r.slide === current) + 1;
  const gaps = slideGaps(view, current, pcw.sentences);

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 lg:grid-cols-[230px_minmax(0,1fr)_260px]">
      <nav aria-label={PCW_COPY.title} className="lg:sticky lg:top-6 lg:self-start">
        <ol className="space-y-1">
          {rail.map((r, i) => (
            <li key={r.slide}>
              <button
                type="button"
                aria-current={r.slide === current ? "step" : undefined}
                onClick={() => go(r.slide)}
                className={`w-full rounded-lg px-3 py-2 text-start text-sm ${r.slide === current ? "bg-brand-100 font-semibold text-brand-900 dark:bg-brand-900/40 dark:text-white" : "hover:bg-slate-100 dark:hover:bg-white/10"}`}
              >
                <span className="block">{i + 1}. {PCW_SLIDES[r.slide].label}</span>
                <span className="block text-xs text-slate-600 dark:text-slate-300">{r.complete ? "✓ " : ""}{r.status}</span>
              </button>
            </li>
          ))}
        </ol>
        <p className="mt-4 px-3 text-xs"><a className="underline" href="/projects/new/wizard?new=1">{PCW_COPY.startNewDraft}</a></p>
      </nav>
      <div className="space-y-4">
      {reading === "READING" ? <p role="status" className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm dark:border-brand-500/30 dark:bg-brand-900/20">{PCW_COPY.documents.reading}</p> : null}
      {reading === "FAILED" ? <p role="alert" className="rounded-xl border border-danger-300 p-3 text-sm">{PCW_COPY.documents.failed} <a className="underline" href="/projects/new/wizard">{PCW_COPY.documents.startOver}</a></p> : null}
      <SlideFrame
        slideKey={current}
        direction={direction}
        eyebrow={`${index} / ${rail.length}`}
        title={PCW_SLIDES[current].label}
        lead={PCW_SLIDES[current].lead}
        back={prev ? { label: PCW_COPY.prevSlide, onClick: () => go(prev) } : undefined}
        next={next ? { label: PCW_COPY.nextSlide, onClick: () => go(next) } : undefined}
      >
        {current === "START" ? (
          <StartSlide id={id} view={view} onView={setView} />
        ) : current === "PROJECT_TEAM" ? (
          <ProjectTeamSlide id={id} view={view} onView={setView} />
        ) : current === "RESULTS" ? (
          <ResultsSlide id={id} view={view} onView={setView} />
        ) : current === "INDICATORS" ? (
          <IndicatorsSlide id={id} view={view} onView={setView} />
        ) : current === "PLACES" ? (
          <PlacesSlide id={id} view={view} onView={setView} />
        ) : current === "WORK_PLAN" ? (
          <WorkPlanSlide id={id} view={view} onView={setView} />
        ) : current === "DATA_ENTRY" ? (
          <DataEntrySlide id={id} view={view} onView={setView} />
        ) : current === "REPORTING" ? (
          <ReportingSlide id={id} view={view} onView={setView} />
        ) : current === "FINANCE" ? (
          <FinanceSlide id={id} view={view} onView={setView} />
        ) : current === "LAUNCH" ? (
          <LaunchSlide id={id} view={view} onView={setView} />
        ) : gaps.length > 0 ? (
          <ul className="list-disc space-y-1 ps-5 text-sm text-slate-700 dark:text-slate-200">{gaps.map((g) => <li key={g.key}>{g.text}</li>)}</ul>
        ) : (
          <p role="status" className="text-sm text-slate-600 dark:text-slate-300">{PCW_COPY.inboxEmpty}</p>
        )}
        <div className="mt-6 space-y-3">
          {current === "START" ? <DocumentsList id={id} view={view} onView={setView} /> : null}
          <LeftOutNote view={view} slide={current} />
          <RereadPart id={id} slide={current} view={view} onView={setView} />
        </div>
      </SlideFrame>
      </div>
      <GapInbox view={view} onOpen={go} />
    </div>
  );
}
