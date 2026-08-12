"use client";

import { useEffect, useReducer, useRef } from "react";
import { updateReportSectionAction } from "@/lib/actions/reporting";
import { AutosaveStatus } from "@/components/editor/AutosaveStatus";
import { UnsavedChangesGuard } from "@/components/editor/UnsavedChangesGuard";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
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
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
        <AutosaveStatus state={displayState} />
      </div>

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
