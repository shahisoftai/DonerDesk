"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  addBlock, addPage, commit, canRedo, canUndo, definitionFor, duplicateBlock, moveBlock, redo, removeBlock, removePage, resizeBlock, setBindings, setBlockAlt, setBlockMotion, type AnimationSpec, setHidden, setLocked,
  setContainer, setTitle, startHistory, setFrame, framesFromCells, applyTheme, resetToTheme, keepOwnColours, setPagePreset, isFreePage, undo, updateProps, projectOf, EMPTY_SELECTION, extendTo, pruneSelection, selectOne, toggle, setBlockFormat, setInteraction, pasteFormat,
  type BlockFormat, type FormatCapability, type InteractionEffect,
  type ArrangeResult, type BlockInstance, type Canvas, type EditResult, type History, type Selection,
} from "@donordesk/domain/contexts/canvas/index.js";
import { seedProps } from "../domain/block-seeds";
import { imageProps } from "../domain/media";
import { STARTER_SETS, starterTop } from "../editor/domain/starters";

const newId = (prefix: string): string => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** The editor's state: the canvas with its undo history, the page and block being worked on, and every change as one named step. Every change is a pure domain operation; a refused one says why and changes nothing. */
export function useCanvasEditor(initial: Canvas, defaultProjectId: string | undefined, fallbackProjectId?: string) {
  const [history, setHistory] = useState<History>(() => startHistory(initial));
  const [pageId, setPageId] = useState(initial.pages[0]?.id ?? "");
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION);
  const [message, setMessage] = useState<string | null>(null);
  const latest = useRef(history.present);
  latest.current = history.present;
  const canvas = history.present;

  /** A selection never names a block that is gone (an undo can remove one). */
  const live = useMemo(() => pruneSelection(history.present, selection), [history.present, selection]);
  const selected: string | null = live.ids.length === 1 ? live.ids[0]! : null;
  const setSelected = useCallback((id: string | null) => setSelection(id ? selectOne(id) : EMPTY_SELECTION), []);
  /** A click (replace), Ctrl/⌘-click (toggle) or Shift-click (range) on a block. */
  const selectBlock = useCallback((id: string, how: { shift?: boolean; mod?: boolean } = {}) => setSelection((s) => (how.shift ? extendTo(latest.current, s, id) : how.mod ? toggle(latest.current, s, id) : selectOne(id))), []);

  const run = useCallback((result: EditResult): EditResult => {
    if (result.ok) { setHistory((h) => commit(h, result.canvas)); setMessage(null); } else setMessage(result.reason);
    return result;
  }, []);
  /** A multi-block gesture: one undo step; blocks it left alone because they are locked are named. */
  const apply = useCallback((r: ArrangeResult): boolean => {
    if (r.ok) { setHistory((h) => commit(h, r.canvas)); setMessage(r.skipped.length > 0 ? `${r.skipped.length} locked block${r.skipped.length === 1 ? " was" : "s were"} left as ${r.skipped.length === 1 ? "it is" : "they are"}.` : null); } else setMessage(r.reason);
    return r.ok;
  }, []);
  /** A block just added takes the canvas's default frame style (the look chosen when it was made), if it has none. */
  const framedLikeCanvas = (r: EditResult, id: string): EditResult => {
    const frame = latest.current.options?.blockFrame;
    if (!r.ok || !frame) return r;
    return { ok: true, canvas: { ...r.canvas, pages: r.canvas.pages.map((p) => ({ ...p, blocks: p.blocks.map((b) => (b.id === id && !b.style?.frame ? { ...b, style: { ...b.style, frame } } : b)) })) } };
  };
  const withBlock = useCallback((id: string, f: (c: Canvas) => EditResult) => run(f(latest.current)), [run]);

  const selectedBlock: BlockInstance | null = useMemo(() => canvas.pages.flatMap((p) => p.blocks).find((b) => b.id === selected) ?? null, [canvas, selected]);
  const pageOf = (id: string) => latest.current.pages.find((p) => p.blocks.some((b) => b.id === id));

  return {
    canvas, pageId, selected, selectedBlock, message, selection: live, selectBlock, setSelection, apply,
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
    /** Selecting a theme gives every block its look: overrides go unless a block is marked to keep its own colours (Phase 61.6). One undo step. */
    setTheme: (themeId: string) => setHistory((h) => commit(h, applyTheme(h.present, themeId))),
    resetTheme: (ids: readonly string[] = []) => setHistory((h) => commit(h, resetToTheme(h.present, ids))),
    keepColours: (id: string, keep: boolean) => setHistory((h) => commit(h, keepOwnColours(h.present, id, keep))),
    /** Moves, resizes or turns one block on a free page, in pixels. */
    frame: (id: string, patch: { x?: number; y?: number; w?: number; h?: number; rot?: number; z?: number }) => withBlock(id, (c) => setFrame(c, id, patch)),
    pagePreset(pageId: string, presetId: string) { const r = setPagePreset(latest.current, pageId, presetId); if (r.ok) { setHistory((h) => commit(h, r.canvas)); setMessage(null); } else setMessage(r.reason); },
    /** A block dropped on a free page lands where the pointer let go (page pixels). */
    addAtPx(kind: string, at: { x: number; y: number }) {
      const id = newId("b");
      let r = addBlock(latest.current, pageId, { id, kind, props: seedProps(kind) });
      const project = defaultProjectId ?? latest.current.pages.flatMap((p) => p.blocks).map((b) => projectOf(b.bindings)).find(Boolean) ?? fallbackProjectId;
      if (r.ok && project && definitionFor(kind)?.slots.some((s) => s.slot === "project")) r = setBindings(r.canvas, id, [{ type: "PROJECT", slot: "project", projectId: project }]);
      if (r.ok) { const m = setFrame(r.canvas, id, { x: at.x, y: at.y }); if (m.ok) r = m; }
      if (run(framedLikeCanvas(r, id)).ok) setSelected(id);
    },
    /** A picture just uploaded: an image block holding it, at the pixel position given on a free page, else below the page's content. */
    addImage(asset: { id: string; name: string }, at?: { x: number; y: number }) {
      const id = newId("b");
      let r = addBlock(latest.current, pageId, { id, kind: "IMAGE", props: imageProps(asset) });
      if (r.ok && at) { const m = setFrame(r.canvas, id, { x: at.x, y: at.y }); if (m.ok) r = m; }
      // The picture's name is its description until the person writes a better one (a public page asks for one).
      if (r.ok) { const a = setBlockAlt(r.canvas, id, asset.name); if (a.ok) r = a; }
      if (run(framedLikeCanvas(r, id)).ok) setSelected(id);
    },
    /** A theme loaded from a file becomes the canvas's look, as one undo step. */
    loadTheme: (spec: NonNullable<Canvas["options"]>["themeSpec"]) => setHistory((h) => commit(h, { ...h.present, themeId: "CUSTOM", options: { ...(h.present.options ?? {}), themeSpec: spec } })),
    add(kind: string, props?: unknown) {
      const id = newId("b");
      let r = addBlock(latest.current, pageId, { id, kind, props: props ?? seedProps(kind) });
      // A new block reads the project the canvas is about; a canvas with none follows the project the page already reads.
      const project = defaultProjectId ?? latest.current.pages.flatMap((p) => p.blocks).map((b) => projectOf(b.bindings)).find(Boolean) ?? fallbackProjectId;
      if (r.ok && project && definitionFor(kind)?.slots.some((s) => s.slot === "project")) r = setBindings(r.canvas, id, [{ type: "PROJECT", slot: "project", projectId: project }]);
      if (run(framedLikeCanvas(r, id)).ok) setSelected(id);
    },
    /** Adds a block where it was dropped: the cell under the pointer (moved down by the grid if that space is taken), as one undo step. */
    addAt(kind: string, cell: { x: number; y: number }) {
      const id = newId("b");
      let r = addBlock(latest.current, pageId, { id, kind, props: seedProps(kind) });
      const project = defaultProjectId ?? latest.current.pages.flatMap((p) => p.blocks).map((b) => projectOf(b.bindings)).find(Boolean) ?? fallbackProjectId;
      if (r.ok && project && definitionFor(kind)?.slots.some((s) => s.slot === "project")) r = setBindings(r.canvas, id, [{ type: "PROJECT", slot: "project", projectId: project }]);
      if (r.ok) { const w = r.canvas.pages.flatMap((p) => p.blocks).find((b) => b.id === id)?.bounds.w ?? 1; const m = moveBlock(r.canvas, id, Math.max(0, Math.min(cell.x, 12 - w)), cell.y); if (m.ok) r = m; }
      if (run(framedLikeCanvas(r, id)).ok) setSelected(id);
    },
    /** A starter set: several blocks laid out together below the page's content, as one undo step. */
    addStarter(setId: string) {
      const set = STARTER_SETS.find((s) => s.id === setId);
      if (!set) return;
      let c = latest.current;
      const top = starterTop(c.pages.find((p) => p.id === pageId)?.blocks ?? []);
      const ids: string[] = [];
      let holder: string | undefined;
      for (const sb of set.blocks) {
        const id = newId("b");
        let r = addBlock(c, pageId, { id, kind: sb.kind, props: sb.props });
        if (!r.ok) { setMessage(r.reason); return; }
        r = moveBlock(r.canvas, id, sb.x, top + sb.y); if (r.ok) r = resizeBlock(r.canvas, id, sb.w, sb.h);
        if (!r.ok) { setMessage(r.reason); return; }
        c = r.canvas;
        const project = defaultProjectId ?? fallbackProjectId;
        if (project && definitionFor(sb.kind)?.slots.some((s) => s.slot === "project")) { const b = setBindings(c, id, [{ type: "PROJECT", slot: "project", projectId: project }]); if (b.ok) c = b.canvas; }
        if (sb.format) c = { ...c, pages: c.pages.map((p) => ({ ...p, blocks: p.blocks.map((b) => (b.id === id ? { ...b, format: sb.format as BlockFormat } : b)) })) };
        if (definitionFor(sb.kind)?.container) holder = id; else if (holder) { const h = setContainer(c, id, { id: holder }); if (h.ok) c = h.canvas; }
        ids.push(id);
      }
      c = framesFromCells(c, pageId, ids);
      setHistory((h) => commit(h, c)); setMessage(null); setSelection({ ids });
    },
    /** One formatting section for every selected block: one undo step. */
    setFormat: (ids: readonly string[], capability: FormatCapability, settings: BlockFormat[FormatCapability] | undefined) => apply(setBlockFormat(latest.current, ids, capability, settings as never)),
    pasteFormat: (fromId: string, toIds: readonly string[]) => apply(pasteFormat(latest.current, fromId, toIds)),
    setInteraction(sourceId: string, targetId: string, effect: InteractionEffect) {
      const next = setInteraction(latest.current, sourceId, targetId, effect);
      if (next) { setHistory((h) => commit(h, next)); setMessage(null); } else setMessage("That block cannot react that way.");
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
    motion: (id: string, motion: AnimationSpec | undefined) => withBlock(id, (c) => setBlockMotion(c, id, motion)),
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
