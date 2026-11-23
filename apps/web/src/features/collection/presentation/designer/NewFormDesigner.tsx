"use client";

import { useEffect, useState } from "react";
import { FormDesigner } from "../FormDesigner";

export const PROPOSAL_KEY = "dd-form-proposal";

/** The new-form designer. When it is opened from "make a form from my tool", the proposed questions wait in this tab's storage and become the starting point. */
export function NewFormDesigner({ projectId, indicators, fromProposal }: { projectId: string; indicators: Array<{ id: string; label: string }>; fromProposal: boolean }) {
  const [start, setStart] = useState<Array<Record<string, unknown>> | undefined | null>(fromProposal ? null : undefined);
  useEffect(() => {
    if (!fromProposal) return;
    try {
      const raw = sessionStorage.getItem(PROPOSAL_KEY);
      setStart(raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : undefined);
    } catch { setStart(undefined); }
  }, [fromProposal]);
  if (start === null) return <p className="text-sm text-slate-500">Loading…</p>;
  return <FormDesigner projectId={projectId} indicators={indicators} {...(start ? { start } : {})} />;
}
