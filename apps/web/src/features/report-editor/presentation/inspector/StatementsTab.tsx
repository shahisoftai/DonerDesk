"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/data/Badge";
import { Button } from "@/components/ui/Button";
import type { ReportClaim } from "@/lib/server/schemas";
import type { Tone } from "@/lib/shared/tone";
import { useRouter } from "next/navigation";
import { confirmClaimMatchesIndicatorAction, getClaimSuggestionAction } from "@/lib/actions/reporting";
import { verificationDetailCopy } from "@/lib/reporting-copy";
import { statementState, type StatementState } from "../../application/statements";
import type { Anchor } from "../../application/claim-anchors";

export type InspectorClaim = ReportClaim;

export type StatementDecision = "keep" | "leave-out";

export type Suggestion = { from: string; to: string; evidenceId: string };

export type StatementHandlers = {
  /** Resolves a statement; resolves to true when saved. */
  onDecide: (claim: InspectorClaim, decision: StatementDecision, notes: string) => Promise<boolean>;
  onUndo: (claim: InspectorClaim) => void;
  onUseEvidence: (claim: InspectorClaim, suggestion: Suggestion) => void;
  onRecheck: () => void;
};

const RANK: Record<StatementState, number> = { open: 0, kept: 1, "left-out": 1, minor: 2, verified: 3 };

const BADGE: Record<StatementState, { label: string; tone: Tone }> = {
  open: { label: "Needs a decision", tone: "warning" },
  kept: { label: "Kept with a note", tone: "success" },
  "left-out": { label: "Left out", tone: "neutral" },
  minor: { label: "Not checked (minor)", tone: "neutral" },
  verified: { label: "Matches evidence", tone: "info" },
};

/**
 * Every checked statement in the selected section: the ones that need a
 * decision first, then decided ones (with Undo), then the rest. Decisions use
 * plain verbs (Report Editor U7): "Use … from evidence" when the evidence
 * holds one matching value, "Keep with a note", "Leave out".
 */
export function StatementsTab({
  claims,
  anchors,
  focusClaimId,
  canResolve,
  canCorrect,
  correctBlockedReason,
  canOverrideConfidential,
  sectionApproved,
  busyClaimId,
  rechecking,
  handlers,
}: {
  claims: InspectorClaim[];
  anchors: ReadonlyMap<string, Anchor | null>;
  focusClaimId?: string;
  canResolve: boolean;
  /** Evidence corrections edit the text (needs edit rights, not while editing). */
  canCorrect: boolean;
  correctBlockedReason?: string;
  canOverrideConfidential: boolean;
  sectionApproved: boolean;
  busyClaimId: string | null;
  rechecking: boolean;
  handlers: StatementHandlers;
}) {
  const focusRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    focusRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    focusRef.current?.focus();
  }, [focusClaimId]);

  if (claims.length === 0) {
    return <p className="text-sm text-slate-600 dark:text-slate-300">No factual statements were checked in this section.</p>;
  }

  const sorted = [...claims].sort((a, b) => RANK[statementState(a)] - RANK[statementState(b)]);
  const open = sorted.filter((c) => statementState(c) === "open").length;
  const unplaced = sorted.filter((c) => statementState(c) === "open" && anchors.get(c.id) === null).length;

  return (
    <>
      <p className="text-sm text-slate-600 dark:text-slate-300" aria-live="polite">
        {open > 0
          ? `${open} of ${claims.length} statement${claims.length === 1 ? "" : "s"} need${open === 1 ? "s" : ""} your decision.`
          : `Nothing to decide — all ${claims.length} statement${claims.length === 1 ? " is" : "s are"} backed by evidence or decided.`}
      </p>
      {unplaced > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-white/10 dark:bg-white/5">
          <p>
            The wording of {unplaced === 1 ? "one statement" : `${unplaced} statements`} changed since it was checked, so it can’t be shown in the text.
          </p>
          {!sectionApproved && (
            <Button size="sm" variant="secondary" className="mt-2" pending={rechecking} onClick={handlers.onRecheck}>
              Re-check section
            </Button>
          )}
        </div>
      )}
      <ul className="space-y-2.5">
        {sorted.map((c) => (
          <StatementCard
            key={c.id}
            claim={c}
            placed={anchors.get(c.id) !== null}
            focused={c.id === focusClaimId}
            focusRef={c.id === focusClaimId ? focusRef : undefined}
            canResolve={canResolve && !sectionApproved}
            canCorrect={canCorrect}
            correctBlockedReason={correctBlockedReason}
            canOverrideConfidential={canOverrideConfidential}
            busy={busyClaimId === c.id}
            handlers={handlers}
          />
        ))}
      </ul>
    </>
  );
}

function StatementCard({
  claim,
  placed,
  focused,
  focusRef,
  canResolve,
  canCorrect,
  correctBlockedReason,
  canOverrideConfidential,
  busy,
  handlers,
}: {
  claim: InspectorClaim;
  placed: boolean;
  focused: boolean;
  focusRef?: React.RefObject<HTMLLIElement>;
  canResolve: boolean;
  canCorrect: boolean;
  correctBlockedReason?: string;
  canOverrideConfidential: boolean;
  busy: boolean;
  handlers: StatementHandlers;
}) {
  const state = statementState(claim);
  const isOpen = state === "open";
  const [decision, setDecision] = useState<StatementDecision | null>(null);
  const [notes, setNotes] = useState("");
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const router = useRouter();
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);

  // B3: ask for a one-click correction only for number mismatches.
  useEffect(() => {
    if (!isOpen || claim.verificationReasonCode !== "VALUE_MISMATCH") return;
    let cancelled = false;
    void getClaimSuggestionAction(claim.id).then((r) => {
      if (!cancelled && r.ok) setSuggestion(r.value.suggestion);
    });
    return () => {
      cancelled = true;
    };
  }, [claim.id, claim.verificationReasonCode, isOpen]);

  const detail = isOpen ? verificationDetailCopy(claim.verificationDetail) : "";
  const titles = Array.from(new Set((claim.sources ?? []).map((s) => s.evidenceTitle ?? "Evidence file")));
  const confidential = claim.verificationReasonCode === "CONFIDENTIALITY_RESTRICTED";

  async function confirmMatch() {
    setMatching(true);
    setMatchError(null);
    const result = await confirmClaimMatchesIndicatorAction(claim.id);
    setMatching(false);
    if (!result.ok) return setMatchError(result.error.message);
    router.refresh();
  }

  async function submit() {
    if (!decision) return;
    if (await handlers.onDecide(claim, decision, notes.trim())) {
      setDecision(null);
      setNotes("");
    }
  }

  return (
    <li
      ref={focusRef}
      tabIndex={focused ? -1 : undefined}
      className={`rounded-lg border p-3 text-sm outline-none ${
        isOpen ? "border-warning-500/50 bg-warning-50/60 dark:bg-warning-500/5" : "border-slate-200 dark:border-white/10"
      } ${focused ? "ring-2 ring-warning-500/40" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={BADGE[state].tone}>{BADGE[state].label}</Badge>
        {isOpen && !placed && <span className="text-xs text-slate-500 dark:text-slate-400">Wording changed</span>}
      </div>
      <p className={`mt-2 font-serif text-[15px] leading-relaxed text-slate-800 dark:text-slate-100 ${state === "left-out" ? "line-through" : ""}`}>“{claim.text}”</p>
      {detail && <p className="mt-1.5 text-slate-600 dark:text-slate-300">{detail}</p>}
      {claim.resolvedById && claim.resolutionNotes && <p className="mt-1.5 text-slate-700 dark:text-slate-200">Note: {claim.resolutionNotes}</p>}
      {titles.length > 0 && <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">Source: {titles.join(", ")}</p>}

      {(state === "kept" || state === "left-out") && canResolve && (
        <button
          type="button"
          disabled={busy}
          onClick={() => handlers.onUndo(claim)}
          className="mt-1.5 min-h-[32px] text-sm font-medium text-brand-700 hover:underline disabled:opacity-50 dark:text-brand-300"
        >
          Undo decision
        </button>
      )}

      {isOpen && !decision && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestion && (
            <Button size="sm" disabled={!canCorrect || busy} pending={busy} onClick={() => handlers.onUseEvidence(claim, suggestion)}>
              Use {suggestion.to} from evidence
            </Button>
          )}
          {canResolve && (
            <>
              {/\d/.test(claim.text) && !confidential && (
                <Button size="sm" variant="secondary" disabled={busy || matching} pending={matching} onClick={() => void confirmMatch()}>
                  This matches a verified indicator
                </Button>
              )}
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => setDecision("keep")}>
                Keep with a note
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setDecision("leave-out")}>
                Leave out
              </Button>
            </>
          )}
          {matchError && <p role="alert" className="w-full text-xs text-danger-700 dark:text-danger-400">{matchError}</p>}
          {!canResolve && !suggestion && <p className="text-xs text-slate-500 dark:text-slate-400">A report manager decides on flagged statements.</p>}
          {suggestion && !canCorrect && correctBlockedReason && <p className="w-full text-xs text-slate-500 dark:text-slate-400">{correctBlockedReason}</p>}
        </div>
      )}

      {isOpen && decision && (
        <div className="mt-2 space-y-2 rounded-md border border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-slate-900/60">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {decision === "keep"
              ? "The statement stays in the report. Explain why it is acceptable — the note is kept with the report."
              : confidential && !canOverrideConfidential
                ? "This statement cites confidential evidence: a grants officer or admin must leave it out."
                : "The statement is removed from the exported report. You can undo this."}
          </p>
          <textarea
            aria-label={decision === "keep" ? "Why this statement is acceptable" : "Reason for leaving it out (optional)"}
            rows={2}
            autoFocus
            value={notes}
            maxLength={2000}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={decision === "keep" ? "For example: Figure confirmed by the district office by phone" : "Optional"}
            className="block w-full rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-white/15 dark:bg-slate-900"
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDecision(null);
                setNotes("");
              }}
            >
              Cancel
            </Button>
            <Button size="sm" pending={busy} disabled={decision === "keep" && notes.trim().length === 0} onClick={() => void submit()}>
              {decision === "keep" ? "Keep with note" : "Leave out"}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
