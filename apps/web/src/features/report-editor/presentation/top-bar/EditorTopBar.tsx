"use client";

import Link from "next/link";
import { Badge } from "@/components/data/Badge";
import { Button } from "@/components/ui/Button";
import { reportDraftStatusTone } from "@/lib/shared/tone";
import { REPORT_DRAFT_STATUS_LABEL } from "@/lib/labels";
import type { PrimaryAction } from "../../application/primary-action";
import { MoreActionsMenu, type MenuItem } from "./MoreActionsMenu";
import { ReadinessButton } from "./ReadinessButton";

export function EditorTopBar({
  backHref,
  eyebrow,
  title,
  draftStatus,
  version,
  readinessPercent,
  todo,
  checksOpen,
  onOpenChecks,
  primary,
  primaryPending,
  onPrimary,
  menuItems,
  generation,
}: {
  backHref: string;
  eyebrow: string;
  title: string;
  draftStatus: string | null;
  version: number | null;
  readinessPercent: number;
  todo: number;
  checksOpen: boolean;
  onOpenChecks: () => void;
  primary: PrimaryAction;
  primaryPending: boolean;
  onPrimary: () => void;
  menuItems: MenuItem[];
  generation: { active: boolean; done: number; total: number; etaLabel: string | null; stopping: boolean; onStop: () => void };
}) {
  return (
    <div className="sticky top-16 z-30 -mx-4 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-slate-950/90 sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 basis-[18rem] items-center gap-3">
        <Link
          href={backHref}
          aria-label="Back to reports"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{eyebrow}</p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-base font-semibold tracking-tight">{title}</h1>
            {draftStatus && (
              <Badge tone={reportDraftStatusTone(draftStatus)}>
                {REPORT_DRAFT_STATUS_LABEL[draftStatus] ?? draftStatus.toLowerCase().replace(/_/g, " ")}
              </Badge>
            )}
            {version !== null && <span className="text-xs text-slate-500 dark:text-slate-400">Version {version}</span>}
          </div>
        </div>
        </div>

        {generation.active ? (
          <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-brand-500" aria-hidden="true" />
            <span className="font-medium">
              Writing sections {generation.done} of {generation.total}
            </span>
            {generation.etaLabel && <span className="text-slate-500 dark:text-slate-400">· {generation.etaLabel}</span>}
            <Button size="sm" variant="ghost" onClick={generation.onStop} pending={generation.stopping}>
              Stop
            </Button>
          </div>
        ) : (
          draftStatus && <ReadinessButton percent={readinessPercent} todo={todo} expanded={checksOpen} onClick={onOpenChecks} />
        )}

        <MoreActionsMenu items={menuItems} />

        {primary.kind !== "none" && (
          <Button onClick={onPrimary} pending={primaryPending} disabled={primary.kind === "waiting"} className="whitespace-nowrap">
            {primary.label}
          </Button>
        )}
      </div>
    </div>
  );
}
