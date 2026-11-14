"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { commandForKey, type CanvasCommand, type ClipboardPayload, type EditorState, readPayload, isContainerKind } from "@donordesk/domain/contexts/canvas/index.js";
import { COMMAND_HANDLERS, nudgeSelection, type EditorPort } from "../domain/command-handlers";
import type { useCanvasEditor } from "./use-canvas-editor";

type Editor = ReturnType<typeof useCanvasEditor>;
const newId = (): string => `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const ZOOM_MIN = 0.4, ZOOM_MAX = 2;
const typing = (t: EventTarget | null): boolean => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

export interface EditorView { zoom: number; grid: boolean; rulers: boolean }

/**
 * The editing session around the canvas (Phase 48.1): the keyboard, the clipboard, zoom and the palette. It builds the `EditorPort` the
 * command table talks to, so every gesture runs through the pure domain functions; nothing here decides what a command means.
 */
export function useEditorSession(ed: Editor, options: { enabled: boolean; save: () => void; preview: () => void; canReachProject: (id: string) => boolean; convert: (id: string) => void }) {
  const [view, setView] = useState<EditorView>({ zoom: 1, grid: false, rulers: false });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [hasClipboard, setHasClipboard] = useState(false);
  const clip = useRef<ClipboardPayload | null>(null);
  const edRef = useRef(ed);
  edRef.current = ed;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const state: EditorState = useMemo(() => ({
    selectedCount: ed.selection.ids.length,
    selectedIsContainer: ed.selection.ids.length === 1 && Boolean(ed.page.blocks.find((b) => b.id === ed.selection.ids[0] && isContainerKind(b.kind))),
    canUndo: ed.canUndo, canRedo: ed.canRedo, hasClipboard,
  }), [ed.selection, ed.page, ed.canUndo, ed.canRedo, hasClipboard]);

  const port = useCallback((): EditorPort => {
    const e = edRef.current;
    return {
      canvas: e.canvas, page: e.page, selection: e.selection,
      select: (s) => e.setSelection(s), apply: (r) => e.apply(r), newId,
      clipboard: {
        get: () => clip.current,
        set: (p) => { clip.current = p; setHasClipboard(true); void navigator.clipboard?.writeText(JSON.stringify(p)).catch(() => undefined); },
      },
      undo: e.undo, redo: e.redo, save: optionsRef.current.save, preview: optionsRef.current.preview,
      view: {
        zoomBy: (f) => setView((v) => ({ ...v, zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(v.zoom * f * 100) / 100)) })),
        zoomTo: (z) => setView((v) => ({ ...v, zoom: z === "fit" ? 1 : z })),
        toggleGrid: () => setView((v) => ({ ...v, grid: !v.grid })), toggleRulers: () => setView((v) => ({ ...v, rulers: !v.rulers })),
      },
      ui: { openPalette: () => setPaletteOpen(true), showShortcuts: () => setShortcutsOpen(true), convert: optionsRef.current.convert },
      canReachProject: optionsRef.current.canReachProject,
    };
  }, []);

  const run = useCallback((command: CanvasCommand | string) => {
    const id = typeof command === "string" ? command : command.id;
    COMMAND_HANDLERS[id]?.(port());
  }, [port]);

  // Paste can also come from another tab or canvas through the system clipboard.
  const pasteFromSystem = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const payload = readPayload(text);
      if (typeof payload !== "string") { clip.current = payload; setHasClipboard(true); }
    } catch { /* the permission was refused: the in-app clipboard is still used */ }
    COMMAND_HANDLERS.paste!(port());
  }, [port]);

  // While a design is being edited the editor has its own command palette and shortcut sheet; the app-wide ones (Ctrl K, G + letter, R, ?)
  // stand down so a key never opens two things. The header's search button still opens the app-wide palette.
  useEffect(() => {
    if (!options.enabled) return undefined;
    document.body.dataset.ownPalette = "canvas";
    return () => { delete document.body.dataset.ownPalette; };
  }, [options.enabled]);

  useEffect(() => {
    if (!options.enabled) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented) return;
      const inField = typing(e.target);
      // Paste reads the system clipboard too, so it is offered even before anything was copied in this editor.
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "v" && !inField) {
        e.preventDefault();
        void pasteFromSystem();
        return;
      }
      const cmd = commandForKey(e, state);
      // While typing in a field the browser keeps its own undo, copy, paste and delete; only the palette, save and the sheet are ours.
      if (inField && !(cmd && ["openPalette", "save"].includes(cmd.id))) return;
      if (cmd) {
        e.preventDefault();
        if (cmd.id === "paste") void pasteFromSystem(); else run(cmd);
        return;
      }
      const arrows = { ArrowLeft: "LEFT", ArrowRight: "RIGHT", ArrowUp: "UP", ArrowDown: "DOWN" } as const;
      const dir = arrows[e.key as keyof typeof arrows];
      if (dir && !(e.ctrlKey || e.metaKey || e.altKey) && edRef.current.selection.ids.length > 0) { e.preventDefault(); nudgeSelection(port(), dir, e.shiftKey); return; }
      if (e.key === "Escape") { if (paletteOpen) setPaletteOpen(false); else if (shortcutsOpen) setShortcutsOpen(false); else edRef.current.setSelection({ ids: [] }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [options.enabled, state, run, port, pasteFromSystem, paletteOpen, shortcutsOpen]);

  return { view, state, paletteOpen, shortcutsOpen, setPaletteOpen, setShortcutsOpen, run };
}
