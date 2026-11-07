"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  addBlock, addPage, commit, canRedo, canUndo, definitionFor, duplicateBlock, moveBlock, redo, removeBlock, removePage, resizeBlock, setBindings, setBlockAlt, setHidden, setLocked,
  setContainer, setTitle, startHistory, undo, updateProps, projectOf, type BlockInstance, type Canvas, type EditResult, type History,
} from "@donordesk/domain/contexts/canvas/index.js";
import { seedProps } from "../domain/block-seeds";

const newId = (prefix: string): string => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** The editor's state: the canvas with its undo history, the page and block being worked on, and every change as one named step. Every change is a pure domain operation; a refused one says why and changes nothing. */
export function useCanvasEditor(initial: Canvas, defaultProjectId: string | undefined, fallbackProjectId?: string) {
  const [history, setHistory] = useState<History>(() => startHistory(initial));
  const [pageId, setPageId] = useState(initial.pages[0]?.id ?? "");
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const latest = useRef(history.present);
  latest.current = history.present;
  const canvas = history.present;

  const run = useCallback((result: EditResult): EditResult => {
    if (result.ok) { setHistory((h) => commit(h, result.canvas)); setMessage(null); } else setMessage(result.reason);
    return result;
  }, []);
  const withBlock = useCallback((id: string, f: (c: Canvas) => EditResult) => run(f(latest.current)), [run]);

  const selectedBlock: BlockInstance | null = useMemo(() => canvas.pages.flatMap((p) => p.blocks).find((b) => b.id === selected) ?? null, [canvas, selected]);
  const pageOf = (id: string) => latest.current.pages.find((p) => p.blocks.some((b) => b.id === id));

  return {
    canvas, pageId, selected, selectedBlock, message,
    page: canvas.pages.find((p) => p.id === pageId) ?? canvas.pages[0]!,
    canUndo: canUndo(history), canRedo: canRedo(history),
    setPageId, setSelected, clearMessage: () => setMessage(null),
    undo: () => setHistory(undo), redo: () => setHistory(redo),
    /** After a save the server's revision replaces ours without becoming an undo step. */
    adoptRevision: (revision: number) => setHistory((h) => ({ ...h, present: { ...h.present, revision } })),
    /** Puts an earlier version on the page as one edit (undoable); the revision and identity stay the current ones. */
    restore: (title: string, from: Canvas) => { setHistory((h) => commit(h, { ...h.present, title, pages: from.pages, profile: from.profile, mode: from.mode, language: from.language, themeId: from.themeId, ...(from.options ? { options: from.options } : {}) })); setPageId(from.pages[0]?.id ?? ""); setSelected(null); },
    rename: (title: string) => run(setTitle(latest.current, title)),
    setMeta: (change: Partial<Pick<Canvas, "profile" | "themeId" | "language" | "mode">>) => setHistory((h) => commit(h, { ...h.present, ...change })),
    add(kind: string) {
      const id = newId("b");
      let r = addBlock(latest.current, pageId, { id, kind, props: seedProps(kind) });
      // A new block reads the project the canvas is about; a canvas with none follows the project the page already reads.
      const project = defaultProjectId ?? latest.current.pages.flatMap((p) => p.blocks).map((b) => projectOf(b.bindings)).find(Boolean) ?? fallbackProjectId;
      if (r.ok && project && definitionFor(kind)?.slots.some((s) => s.slot === "project")) r = setBindings(r.canvas, id, [{ type: "PROJECT", slot: "project", projectId: project }]);
      if (run(r).ok) setSelected(id);
    },
    setProps: (id: string, props: unknown) => withBlock(id, (c) => updateProps(c, id, props)),
    setProject: (id: string, projectId: string) => withBlock(id, (c) => setBindings(c, id, [{ type: "PROJECT", slot: "project", projectId }])),
    bounds(id: string, change: { x?: number; y?: number; w?: number; h?: number }) {
      const b = latest.current.pages.flatMap((p) => p.blocks).find((x) => x.id === id);
      if (!b) return;
      const next = { ...b.bounds, ...change };
      if (change.x !== undefined || change.y !== undefined) { const r = run(moveBlock(latest.current, id, next.x, next.y)); if (!r.ok) return; if (change.w === undefined && change.h === undefined) return; withBlockAfter(r.canvas, id, next.w, next.h); return; }
      run(resizeBlock(latest.current, id, next.w, next.h));
    },
    container: (id: string, container: { id: string; tab?: number } | undefined) => withBlock(id, (c) => setContainer(c, id, container)),
    alt: (id: string, alt: string, description: string) => withBlock(id, (c) => setBlockAlt(c, id, alt || undefined, description || undefined)),
    act(id: string, action: "duplicate" | "remove" | "hide" | "lock") {
      const b = latest.current.pages.flatMap((p) => p.blocks).find((x) => x.id === id);
      if (!b) return;
      if (action === "duplicate") { const copy = newId("b"); if (run(duplicateBlock(latest.current, id, copy)).ok) setSelected(copy); }
      else if (action === "remove") { if (run(removeBlock(latest.current, id)).ok) setSelected(null); }
      else if (action === "hide") run(setHidden(latest.current, id, b.style?.hidden !== true));
      else run(setLocked(latest.current, id, b.style?.locked !== true));
    },
    addPage() { const id = newId("p"); if (run(addPage(latest.current, { id, title: `Page ${latest.current.pages.length + 1}`, format: latest.current.pages[0]?.format ?? "WEB_FLUID" })).ok) setPageId(id); },
    removePage(id: string) { if (run(removePage(latest.current, id)).ok) setPageId(latest.current.pages.find((p) => p.id !== id)?.id ?? ""); },
    renamePage: (id: string, title: string) => setHistory((h) => commit(h, { ...h.present, pages: h.present.pages.map((p) => (p.id === id ? { ...p, title } : p)) })),
    projectOfBlock: (b: BlockInstance) => projectOf(b.bindings),
    pageOf,
  };

  // A move and a resize in one edit: the second step reads the canvas the first produced.
  function withBlockAfter(after: Canvas, id: string, w: number, h: number) {
    const r = resizeBlock(after, id, w, h);
    if (r.ok) setHistory((hist) => commit(hist, r.canvas)); else setMessage(r.reason);
  }
}
