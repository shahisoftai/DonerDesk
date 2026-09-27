"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Extension } from "@tiptap/core";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { updateReportSectionAction } from "@/lib/actions/reporting";
import { Button } from "@/components/ui/Button";
import { UnsavedChangesGuard } from "@/components/editor/UnsavedChangesGuard";
import { autosaveReducer, createAutosaveState, isDirty, type AutosaveStatus } from "@/features/reporting/application/autosave-reducer";
import { reportEditorExtensions } from "./extensions";
import { canonicalSectionMarkdown, toStorageMarkdown } from "./markdown-io";
import { cleanPastedHtml } from "./paste-cleanup";
import { EditorToolbar } from "./EditorToolbar";
import { LinkEditor } from "./LinkEditor";

const SAVE_DELAY_MS = 800;

export type RichEditorSaveStatus = AutosaveStatus;

/**
 * WYSIWYG editor for one report section. The document shows formatted text,
 * never markdown; content is stored as the canonical markdown subset
 * (`toStorageMarkdown`). Opening and closing without typing never saves, so
 * no spurious revision is created. Autosave, conflict recovery and the
 * unsaved-changes guard follow the classic SectionEditor behaviour.
 */
export default function RichSectionEditor({
  sectionId,
  title,
  initialContent,
  initialVersion,
  onReload,
  onStatusChange,
  onDone,
}: {
  sectionId: string;
  title: string;
  initialContent: string;
  initialVersion: string;
  onReload: () => void;
  onStatusChange?: (status: RichEditorSaveStatus) => void;
  /** Called after any pending text is saved (the "Done editing" button). */
  onDone: () => void;
}) {
  const [finishing, setFinishing] = useState(false);
  const original = useMemo(() => canonicalSectionMarkdown(initialContent), [initialContent]);
  const [state, dispatch] = useReducer(autosaveReducer, undefined, () => createAutosaveState(original, initialVersion));
  const [linkOpen, setLinkOpen] = useState(false);
  const [words, setWords] = useState(0);
  const latestRef = useRef(original);
  const savedRef = useRef(original);
  const versionRef = useRef(initialVersion);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);

  useEffect(() => onStatusChange?.(state.status), [state.status, onStatusChange]);

  const doSave = useCallback(
    async (text: string) => {
      if (savingRef.current || text === savedRef.current) return;
      savingRef.current = true;
      dispatch({ type: "save-start" });
      try {
        let result: Awaited<ReturnType<typeof updateReportSectionAction>>;
        try {
          result = await updateReportSectionAction(sectionId, { content: text, expectedVersion: versionRef.current });
        } catch {
          dispatch({ type: "save-fail", error: "Could not reach the server. Your text is kept here." });
          return;
        }
        if (!result.ok) {
          dispatch(result.error.kind === "conflict" ? { type: "conflict", error: result.error.message } : { type: "save-fail", error: result.error.message });
          return;
        }
        versionRef.current = result.value.version;
        savedRef.current = text;
        dispatch({ type: "save-success", version: result.value.version });
      } finally {
        savingRef.current = false;
      }
      // Text changed while the save was in flight: save again.
      if (latestRef.current !== savedRef.current) {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => void doSave(latestRef.current), SAVE_DELAY_MS);
      }
    },
    [sectionId],
  );

  const openLinkRef = useRef<() => void>(() => undefined);
  const linkShortcut = useMemo(
    () =>
      Extension.create({
        name: "reportLinkShortcut",
        addKeyboardShortcuts() {
          return {
            "Mod-k": () => {
              openLinkRef.current();
              return true;
            },
          };
        },
      }),
    [],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: reportEditorExtensions([
      Placeholder.configure({ placeholder: "Write this section…" }),
      CharacterCount,
      linkShortcut,
    ]),
    content: original,
    contentType: "markdown",
    autofocus: "end",
    editorProps: {
      attributes: {
        class: "report-prose",
        "aria-label": `Edit section: ${title}`,
        "aria-multiline": "true",
        role: "textbox",
      },
      transformPastedHTML: cleanPastedHtml,
    },
    onCreate: ({ editor: e }) => {
      setWords(e.storage.characterCount.words());
      // Baseline = what this editor serialises for the untouched content.
      // Load-time normalisation (e.g. table fixing) emits updates; comparing
      // against this baseline means only real edits ever trigger a save.
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      const baseline = toStorageMarkdown(e.getMarkdown());
      latestRef.current = baseline;
      savedRef.current = baseline;
      dispatch({ type: "init", text: baseline, version: versionRef.current });
    },
    onUpdate: ({ editor: e }) => {
      setWords(e.storage.characterCount.words());
      const text = toStorageMarkdown(e.getMarkdown());
      latestRef.current = text;
      dispatch({ type: "input", text });
      if (timerRef.current) clearTimeout(timerRef.current);
      if (text === savedRef.current) return;
      timerRef.current = setTimeout(() => void doSave(text), SAVE_DELAY_MS);
    },
  });

  openLinkRef.current = () => setLinkOpen(true);

  // Flush a pending save when the editor closes (Done editing / switching
  // sections) so nothing typed in the last 800 ms is lost.
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        if (latestRef.current !== savedRef.current) void doSave(latestRef.current);
      }
    };
  }, [doSave]);

  const dirty = isDirty(state);

  async function finish() {
    setFinishing(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    // Wait for an in-flight save, then save whatever is still pending.
    for (let i = 0; i < 50 && savingRef.current; i += 1) await new Promise((r) => setTimeout(r, 100));
    if (latestRef.current !== savedRef.current) await doSave(latestRef.current);
    setFinishing(false);
    if (latestRef.current === savedRef.current) onDone();
  }

  if (!editor) {
    return <div className="report-prose min-h-[6rem] animate-pulse rounded bg-slate-50 dark:bg-white/5" aria-busy="true" />;
  }

  return (
    <div className="space-y-2">
      <div className="sticky top-36 z-10">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <EditorToolbar editor={editor} onLink={() => setLinkOpen((v) => !v)} />
          </div>
          <Button size="sm" onClick={() => void finish()} pending={finishing} className="mt-1 shrink-0">
            Done editing
          </Button>
        </div>
        {linkOpen && (
          <div className="mt-1">
            <LinkEditor editor={editor} onClose={() => setLinkOpen(false)} />
          </div>
        )}
      </div>

      {state.status === "conflict" && (
        <div role="alert" className="rounded-lg border border-warning-500/30 bg-warning-50 p-3 dark:bg-warning-500/5">
          <p className="text-sm font-medium text-warning-700 dark:text-warning-500">{state.error}</p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            Your unsaved text is shown below so nothing is lost. Load the latest version to continue editing.
          </p>
          {state.recovery !== undefined && (
            <textarea
              aria-label="Copy of your unsaved text"
              readOnly
              value={state.recovery}
              className="mt-2 h-24 w-full rounded-lg border border-slate-300 bg-white p-2 font-mono text-xs dark:border-white/10 dark:bg-slate-900/60"
            />
          )}
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="secondary" onClick={onReload}>
              Load latest version
            </Button>
          </div>
        </div>
      )}

      {state.status === "failed" && (
        <p role="alert" className="text-sm font-medium text-danger-700 dark:text-danger-400">
          {state.error ?? "Could not save."}{" "}
          <button type="button" className="underline" onClick={() => void doSave(latestRef.current)}>
            Try again
          </button>
        </p>
      )}

      <BubbleMenu
        editor={editor}
        shouldShow={({ editor: e, state: s }) => !s.selection.empty && !e.isActive("table")}
        className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-slate-900"
      >
        <BubbleButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <span className="font-bold">B</span>
        </BubbleButton>
        <BubbleButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <span className="font-serif italic">I</span>
        </BubbleButton>
        <BubbleButton label="Link" active={editor.isActive("link")} onClick={() => setLinkOpen(true)}>
          Link
        </BubbleButton>
        <BubbleButton label="Heading" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          H3
        </BubbleButton>
      </BubbleMenu>

      <div className={state.status === "conflict" ? "pointer-events-none opacity-60" : ""}>
        <EditorContent editor={editor} />
      </div>
      <p className="text-right text-xs text-slate-400 dark:text-slate-500" aria-live="off">
        {words.toLocaleString()} word{words === 1 ? "" : "s"}
      </p>

      <UnsavedChangesGuard dirty={dirty} message="You have unsaved report changes. Leave anyway?" />
    </div>
  );
}

function BubbleButton({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`h-8 min-w-[32px] rounded-md px-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10 ${
        active ? "bg-brand-500/15 text-brand-700 dark:text-brand-300" : ""
      }`}
    >
      {children}
    </button>
  );
}
