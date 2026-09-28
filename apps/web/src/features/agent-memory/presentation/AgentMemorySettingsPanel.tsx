"use client";

import { useEffect, useState } from "react";
import { updateAgentMemorySettingsAction } from "@/lib/actions/org";
import {
  listAgentMemoryAction,
  approveAgentMemoryAction,
  rejectAgentMemoryAction,
  deactivateAgentMemoryAction,
  type AgentMemoryOutput,
} from "@/lib/actions/agent-memory";
import { useActionState } from "@/lib/client/action-state";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import { Button } from "@/components/ui/Button";

const CATEGORY_LABELS: Record<string, string> = {
  TONE: "Tone",
  STRUCTURE: "Structure",
  TERMINOLOGY: "Terminology",
  FORMATTING: "Formatting",
  LENGTH: "Length",
};

const SCOPE_LABELS: Record<string, string> = {
  ORGANIZATION: "All reports",
  DONOR: "This donor",
  TEMPLATE: "This template",
  SECTION_TYPE: "This section",
};

export function AgentMemorySettingsPanel({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const toggleState = useActionState();
  const [pending, setPending] = useState<AgentMemoryOutput[] | null>(null);
  const [active, setActive] = useState<AgentMemoryOutput[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadLists() {
    const [p, a] = await Promise.all([listAgentMemoryAction("PROPOSED"), listAgentMemoryAction("ACTIVE")]);
    if (!p.ok) { setLoadError(p.error.message); return; }
    if (!a.ok) { setLoadError(a.error.message); return; }
    setLoadError(null);
    setPending(p.value);
    setActive(a.value);
  }

  useEffect(() => {
    if (enabled) void loadLists();
  }, [enabled]);

  async function toggle(next: boolean) {
    const result = await toggleState.run(() => updateAgentMemorySettingsAction({ enabled: next }));
    if (result !== undefined) setEnabled(next);
  }

  async function act(id: string, action: () => Promise<{ ok: boolean; error?: { message: string } }>) {
    setBusyId(id);
    const result = await action();
    setBusyId(null);
    if (result.ok) await loadLists();
    else setLoadError(result.error?.message ?? "Something went wrong");
  }

  return (
    <div className="space-y-6">
      <div className="card flex items-start justify-between gap-4">
        <div>
          <div className="font-medium text-slate-900 dark:text-slate-100">Learn from reviewer edits</div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            When on, DonorDesk watches for consistent wording or structure changes your team makes to AI-drafted
            sections and proposes them as reusable style guidance. Numbers, dates, and facts are never learned this
            way — every suggestion is reviewed by a report manager before it can influence future drafts.
          </p>
          {toggleState.error && <div className="mt-2"><InlineAlert tone="danger" title={toggleState.error} /></div>}
        </div>
        <label className="flex shrink-0 items-center gap-2 pt-1 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            disabled={toggleState.busy}
            onChange={(e) => void toggle(e.target.checked)}
          />
          {enabled ? "On" : "Off"}
        </label>
      </div>

      {enabled && (
        <>
          {loadError && <InlineAlert tone="danger" title={loadError} />}

          <div className="card">
            <h2 className="font-medium text-slate-900 dark:text-slate-100">
              Suggestions waiting for you {pending ? `(${pending.length})` : ""}
            </h2>
            {pending === null ? (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Loading…</p>
            ) : pending.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                No suggestions yet. They appear here as the team&apos;s edits to AI-drafted sections accumulate.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {pending.map((m) => (
                  <li key={m.id} className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700 dark:bg-white/10 dark:text-slate-200">
                        {CATEGORY_LABELS[m.category] ?? m.category}
                      </span>
                      <span>Seen {m.occurrenceCount} time{m.occurrenceCount === 1 ? "" : "s"}</span>
                      <span>&middot;</span>
                      <span>Suggested scope: {SCOPE_LABELS[m.scope] ?? m.scope}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-800 dark:text-slate-100">{m.statement}</p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        type="button"
                        pending={busyId === m.id}
                        onClick={() => void act(m.id, () => approveAgentMemoryAction(m.id))}
                      >
                        Approve
                      </Button>
                      <button
                        type="button"
                        disabled={busyId === m.id}
                        onClick={() => void act(m.id, () => rejectAgentMemoryAction(m.id))}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-red-400 hover:text-red-700 disabled:opacity-50 dark:border-white/15 dark:text-slate-200"
                      >
                        Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <h2 className="font-medium text-slate-900 dark:text-slate-100">
              Active style preferences {active ? `(${active.length})` : ""}
            </h2>
            {active === null ? (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Loading…</p>
            ) : active.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No approved style preferences yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {active.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10">
                    <div>
                      <p className="text-sm text-slate-800 dark:text-slate-100">{m.statement}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Applies to: {SCOPE_LABELS[m.scope] ?? m.scope}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busyId === m.id}
                      onClick={() => void act(m.id, () => deactivateAgentMemoryAction(m.id))}
                      className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand-400 hover:text-brand-700 disabled:opacity-50 dark:border-white/15 dark:text-slate-200"
                    >
                      Pause
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
