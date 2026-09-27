"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { verificationDetailCopy } from "@/lib/reporting-copy";
import { statementState } from "../../application/statements";
import type { InspectorClaim } from "../inspector/StatementsTab";

const STATE_LABEL: Record<string, string> = {
  open: "Needs a decision",
  kept: "Kept with a note",
  "left-out": "Left out of the report",
  verified: "Matches evidence",
  minor: "Could not be checked (not material)",
};

const EXCERPT_MAX = 220;

/**
 * Popover for a statement marked in the text (Report Editor U2): its status,
 * the evidence it was checked against with the matched excerpt, and a link
 * to open the evidence. Positioned next to the marked text; stays open while
 * the pointer is over it; never steals focus (keyboard users press Enter on
 * the statement to open the full details in the inspector).
 */
export function EvidencePeek({
  claim,
  anchor,
  projectId,
  onHoverChange,
}: {
  claim: InspectorClaim;
  anchor: HTMLElement;
  projectId: string;
  /** The pointer entered (true) / left (false) the popover, so it can stay open. */
  onHoverChange: (hovering: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const rect = anchor.getBoundingClientRect();
    const width = ref.current?.offsetWidth ?? 320;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const below = rect.bottom + 8;
    const height = ref.current?.offsetHeight ?? 160;
    const top = below + height > window.innerHeight - 8 ? Math.max(8, rect.top - height - 8) : below;
    setPos({ top, left });
  }, [anchor]);

  const state = statementState(claim);
  const sources = claim.sources ?? [];
  const detail = state === "open" ? verificationDetailCopy(claim.verificationDetail) : "";
  const first = sources[0];
  const excerpt = first?.sourceText ? (first.sourceText.length > EXCERPT_MAX ? `${first.sourceText.slice(0, EXCERPT_MAX)}…` : first.sourceText) : null;
  const titles = Array.from(new Set(sources.map((s) => s.evidenceTitle ?? "Evidence file")));

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Statement evidence"
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      style={pos ? { top: pos.top, left: pos.left } : { visibility: "hidden", top: 0, left: 0 }}
      className="fixed z-40 w-80 max-w-[calc(100vw-1rem)] rounded-xl border border-slate-200 bg-white p-3 font-sans text-sm shadow-lg dark:border-white/10 dark:bg-slate-900"
    >
      <p className={`text-xs font-semibold ${state === "open" ? "text-warning-700 dark:text-warning-400" : "text-slate-600 dark:text-slate-300"}`}>
        {STATE_LABEL[state]}
      </p>
      {detail && <p className="mt-1 text-slate-700 dark:text-slate-200">{detail}</p>}
      {titles.length > 0 ? (
        <p className="mt-1.5 text-slate-700 dark:text-slate-200">
          <span className="text-slate-500 dark:text-slate-400">Evidence: </span>
          {titles.join(", ")}
        </p>
      ) : (
        <p className="mt-1.5 text-slate-500 dark:text-slate-400">No evidence file is linked to this statement.</p>
      )}
      {excerpt && <blockquote className="mt-1.5 border-l-2 border-slate-200 pl-2 text-xs italic text-slate-600 dark:border-white/15 dark:text-slate-300">“{excerpt}”</blockquote>}
      {first && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Click the statement for details
          {" · "}
          <Link href={`/projects/${projectId}/evidence/${first.evidenceId}`} className="font-medium text-brand-700 hover:underline dark:text-brand-300">
            Open evidence
          </Link>
        </p>
      )}
    </div>
  );
}
