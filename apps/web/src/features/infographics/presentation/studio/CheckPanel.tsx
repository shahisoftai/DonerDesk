"use client";

import { useState } from "react";
import { designRuleTitle } from "@donordesk/domain/contexts/infographics/index.js";
import { Badge } from "@/components/data/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SEVERITY_INFO } from "../../domain/studio-copy";
import type { CheckResult, Finding } from "../../domain/studio-api";
import { PanelHeading } from "./primitives";

interface Props {
  check: CheckResult | undefined;
  checking: boolean;
  canEdit: boolean;
  waived: Array<{ ruleId: string; note: string }>;
  onSelect: (sectionIndex: number) => void;
  onWaive: (ruleId: string, note: string) => void;
  onUnwaive: (ruleId: string) => void;
}

/** The Design check: what to fix before this is published, in plain words, each finding next to the block it is about. */
export function CheckPanel({ check, checking, canEdit, waived, onSelect, onWaive, onUnwaive }: Props) {
  const [waiving, setWaiving] = useState<string | undefined>();
  const [note, setNote] = useState("");
  if (!check) return <p className="text-sm text-slate-500">{checking ? "Checking the design…" : "The design check appears once the preview has loaded."}</p>;
  const groups: Array<Finding["severity"]> = ["BLOCKER", "WARN", "TIP"];
  const count = (s: Finding["severity"]): number => check.findings.filter((f) => f.severity === s && !f.waived).length;
  return (
    <div className="space-y-3 text-sm" aria-live="polite">
      <PanelHeading>Design check</PanelHeading>
      <p className={check.canPublish ? "text-green-700" : "text-red-700"}>{check.canPublish ? "Nothing stops this from being published." : `${count("BLOCKER")} thing${count("BLOCKER") === 1 ? "" : "s"} to fix before publishing.`}</p>
      {check.findings.length === 0 && <p className="text-slate-500">Every check passes.</p>}
      {groups.map((severity) => {
        const items = check.findings.filter((f) => f.severity === severity);
        if (items.length === 0) return null;
        return (
          <section key={severity} aria-label={SEVERITY_INFO[severity].label} className="space-y-2">
            <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {SEVERITY_INFO[severity].label}
              <Badge tone={SEVERITY_INFO[severity].tone}>{items.length}</Badge>
            </h4>
            <ul className="space-y-2">
              {items.map((finding, i) => (
                <li key={`${finding.ruleId}-${finding.sectionIndex ?? "x"}-${i}`} className="rounded-lg border border-slate-200 p-2.5 dark:border-white/10">
                  <p className="font-medium">{finding.message}</p>
                  <p className="mt-0.5 text-slate-600 dark:text-slate-300">{finding.fix}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{designRuleTitle(finding.ruleId)}</span>
                    {finding.sectionIndex !== undefined && (
                      <button type="button" className="text-brand-700 underline dark:text-brand-300" onClick={() => onSelect(finding.sectionIndex as number)}>
                        Go to this block
                      </button>
                    )}
                    {finding.waived && <Badge tone="neutral">Waived: {waived.find((w) => w.ruleId === finding.ruleId)?.note}</Badge>}
                    {canEdit && finding.severity === "BLOCKER" && !finding.waived && (
                      <button type="button" className="underline" onClick={() => (setWaiving(finding.ruleId), setNote(""))}>
                        Publish anyway, with a reason
                      </button>
                    )}
                    {canEdit && finding.waived && (
                      <button type="button" className="underline" onClick={() => onUnwaive(finding.ruleId)}>
                        Take the waiver back
                      </button>
                    )}
                  </div>
                  {waiving === finding.ruleId && (
                    <div className="mt-2 space-y-2">
                      <Input aria-label="Why is this acceptable?" placeholder="Why is this acceptable?" maxLength={200} value={note} onChange={(event) => setNote(event.target.value)} />
                      <div className="flex gap-2">
                        <Button size="sm" disabled={!note.trim()} onClick={() => (onWaive(finding.ruleId, note.trim()), setWaiving(undefined))}>
                          Waive for this design
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setWaiving(undefined)}>
                          Cancel
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500">The reason is saved with the design and recorded when it is published.</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
