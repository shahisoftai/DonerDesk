"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { updateReportSectionAction, rewriteReportSectionAction } from "@/lib/actions/reporting";
import { AutosaveStatus } from "@/components/editor/AutosaveStatus";
import { UnsavedChangesGuard } from "@/components/editor/UnsavedChangesGuard";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import {
  autosaveReducer,
  createAutosaveState,
  isDirty,
} from "@/features/reporting/application/autosave-reducer";

const SAVE_DELAY_MS = 800;

export function SectionEditor({
  sectionId,
  title,
  initialContent,
  initialVersion,
  readOnly,
  onReload,
}: {
  sectionId: string;
  title: string;
  initialContent: string;
  initialVersion: string;
  readOnly: boolean;
  onReload: () => void;
}) {
  const [state, dispatch] = useReducer(
    autosaveReducer,
    undefined,
    () => createAutosaveState(initialContent, initialVersion),
  );
  const latestTextRef = useRef(initialContent);
  const versionRef = useRef(initialVersion);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [rewriteOpen, setRewriteOpen] = useState(false);
  const [rewriteMode, setRewriteMode] = useState<"REWRITE" | "SHORTEN">("REWRITE");
  const [rewriteAudience, setRewriteAudience] = useState<"DONOR" | "INTERNAL" | "GENERAL">("DONOR");
  const [rewriting, setRewriting] = useState(false);
  const [rewriteError, setRewriteError] = useState<string | null>(null);
  const [rewriteNotice, setRewriteNotice] = useState<string | null>(null);

  async function runRewrite() {
    if (rewriting) return;
    setRewriting(true);
    setRewriteError(null);
    setRewriteNotice(null);
    const result = await rewriteReportSectionAction(sectionId, {
      mode: rewriteMode,
      audience: rewriteAudience,
    });
    setRewriting(false);
    if (!result.ok) {
      setRewriteError(result.error.message);
      return;
    }
    if (result.value.fallbackUsed) {
      // The provider fell back to the stub generator — the rewrite still
      // produces a deterministic rewrite (e.g. sentence case, audience tone)
      // but the user must know it was not a real AI rewrite.
      setRewriteNotice(
        `AI rewrite was unavailable (${result.value.fallbackReason ?? "PROVIDER_NOT_CONFIGURED"}); a deterministic rewrite was applied instead.`,
      );
    }
    // Always reload from the server so the editor reflects the persisted
    // revision (and any other server-side changes) instead of trusting the
    // dispatcher's local state. The new version returned by the server is
    // already the persisted revision's version.
    if (timerRef.current) clearTimeout(timerRef.current);
    onReload();
    setRewriteOpen(false);
  }

  useEffect(() => {
    latestTextRef.current = state.text;
  }, [state.text]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function doSave(text: string) {
    const expectedVersion = versionRef.current;
    dispatch({ type: "save-start" });
    const result = await updateReportSectionAction(sectionId, {
      content: text,
      expectedVersion,
    });
    if (!result.ok) {
      if (result.error.kind === "conflict") {
        dispatch({ type: "conflict", error: result.error.message });
      } else {
        dispatch({ type: "save-fail", error: result.error.message });
      }
      return;
    }
    versionRef.current = result.value.version;
    dispatch({ type: "save-success", version: result.value.version });
    if (latestTextRef.current !== text) {
      scheduleSave(latestTextRef.current);
    }
  }

  function scheduleSave(text: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void doSave(text);
    }, SAVE_DELAY_MS);
  }

  function onChange(text: string) {
    dispatch({ type: "input", text });
    scheduleSave(text);
  }

  function saveNow() {
    if (timerRef.current) clearTimeout(timerRef.current);
    void doSave(latestTextRef.current);
  }

  function discardLocal() {
    if (timerRef.current) clearTimeout(timerRef.current);
    dispatch({ type: "discard-local" });
    onReload();
  }

  const dirty = isDirty(state);
  const displayState = state.status === "dirty" ? "idle" : state.status;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-slate-800 dark:text-slate-100">{title}</h2>
        <div className="flex items-center gap-2">
          {!readOnly && state.text.trim() && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setRewriteOpen((v) => !v);
                setRewriteNotice(null);
                setRewriteError(null);
              }}
            >
              {rewriteOpen ? "Close AI rewrite" : "AI rewrite"}
            </Button>
          )}
          <AutosaveStatus state={displayState} />
        </div>
      </div>

      {rewriteOpen && !readOnly && (
        <div className="rounded-lg border border-brand-500/30 bg-brand-500/5 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Mode" htmlFor="rewrite-mode">
              <Select id="rewrite-mode" value={rewriteMode} onChange={(e) => setRewriteMode(e.target.value as "REWRITE" | "SHORTEN")}>
                <option value="REWRITE">Rewrite for clarity</option>
                <option value="SHORTEN">Shorten</option>
              </Select>
            </Field>
            <Field label="Audience" htmlFor="rewrite-audience">
              <Select id="rewrite-audience" value={rewriteAudience} onChange={(e) => setRewriteAudience(e.target.value as "DONOR" | "INTERNAL" | "GENERAL")}>
                <option value="DONOR">Donor-friendly</option>
                <option value="INTERNAL">Internal</option>
                <option value="GENERAL">General</option>
              </Select>
            </Field>
          </div>
          {rewriteError && (
            <p role="alert" className="mt-2 text-sm font-medium text-danger-700 dark:text-danger-400">{rewriteError}</p>
          )}
          {rewriteNotice && (
            <p role="status" className="mt-2 text-sm text-warning-700 dark:text-warning-400">{rewriteNotice}</p>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setRewriteOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={runRewrite} pending={rewriting}>
              {rewriting ? "Rewriting…" : "Apply rewrite"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            AI rewriting preserves your facts and source references; it never invents new claims. This can take up to three minutes.
          </p>
        </div>
      )}

      {state.status === "conflict" && (
        <div role="alert" className="rounded-lg border border-warning-500/30 bg-warning-500/5 p-3">
          <p className="text-sm font-medium text-warning-700 dark:text-warning-400">{state.error}</p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            Your unsaved changes are shown below for recovery. Reload the latest version to continue editing — your
            draft is never silently overwritten.
          </p>
          {state.recovery !== undefined && (
            <textarea
              aria-label="Recovery copy of unsaved changes"
              readOnly
              value={state.recovery}
              className="mt-2 h-24 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs dark:border-white/10 dark:bg-slate-900/60"
            />
          )}
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="secondary" onClick={onReload}>
              Load latest version
            </Button>
            <Button size="sm" variant="ghost" onClick={discardLocal}>
              Discard my unsaved changes
            </Button>
          </div>
        </div>
      )}

      {state.status === "failed" && (
        <p role="alert" className="text-xs font-medium text-danger-700 dark:text-danger-400">
          {state.error ?? "Save failed."}{" "}
          <button type="button" className="underline" onClick={saveNow}>
            Retry
          </button>
        </p>
      )}

      <Textarea
        aria-label={`Edit section ${title}`}
        value={state.text}
        onChange={(e) => onChange(e.target.value)}
        disabled={readOnly || state.status === "conflict"}
        className="min-h-[320px] text-sm"
        placeholder="Write this section…"
      />

      <UnsavedChangesGuard dirty={dirty} message="You have unsaved report changes. Leave anyway?" />
    </div>
  );
}
