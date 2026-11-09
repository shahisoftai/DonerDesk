/**
 * What each editing command does (Phase 48.1): a table from command id to a function that calls the pure gestures of the canvas
 * domain through a small port. No React, no browser: the editor hook supplies the port, a test supplies a fake. A command with no
 * entry here is a test failure, so the palette can never list something that does nothing.
 */
import {
  CANVAS_COMMANDS, align, copyBlocks, distribute, duplicateMany, groupBlocks, marquee, matchSize, nudge, pasteBlocks, removeMany, reorder, selectAll, selectSameKind, setFlag, ungroup,
  type Alignment, type ArrangeResult, type Canvas, type CanvasPage, type ClipboardPayload, type OrderMove, type Selection,
} from "@donordesk/domain/contexts/canvas/index.js";

export interface EditorPort {
  canvas: Canvas;
  page: CanvasPage;
  selection: Selection;
  select(next: Selection): void;
  /** Commits a result as one undo step, or shows its reason; a locked-block note is added by the caller. */
  apply(result: ArrangeResult): boolean;
  newId(): string;
  clipboard: { get(): ClipboardPayload | null; set(payload: ClipboardPayload): void };
  undo(): void;
  redo(): void;
  save(): void;
  preview(): void;
  view: { zoomBy(factor: number): void; zoomTo(value: number | "fit"): void; toggleGrid(): void; toggleRulers(): void };
  ui: { openPalette(): void; showShortcuts(): void; convert(id: string): void };
  canReachProject(projectId: string): boolean;
}

type Handler = (p: EditorPort) => void;
const ids = (p: EditorPort): string[] => [...p.selection.ids];
const aligner = (how: Alignment): Handler => (p) => void p.apply(align(p.canvas, ids(p), how));
const orderer = (move: OrderMove): Handler => (p) => void p.apply(reorder(p.canvas, ids(p), move));

function paste(p: EditorPort): void {
  const payload = p.clipboard.get();
  if (!payload) return;
  const r = pasteBlocks(p.canvas, p.page.id, payload, p.newId, undefined, p.canReachProject);
  if (p.apply(r.ok ? { ok: true, canvas: r.canvas, skipped: [] } : r)) if (r.ok) p.select({ ids: r.pastedIds, anchor: r.pastedIds[0] });
}

function copy(p: EditorPort): ClipboardPayload | null {
  const payload = copyBlocks(p.canvas, ids(p));
  if (payload) p.clipboard.set(payload);
  return payload;
}

export const COMMAND_HANDLERS: Readonly<Record<string, Handler>> = {
  undo: (p) => p.undo(),
  redo: (p) => p.redo(),
  copy: (p) => void copy(p),
  cut: (p) => { if (copy(p) && p.apply(removeMany(p.canvas, ids(p)))) p.select({ ids: [] }); },
  paste,
  duplicate: (p) => {
    const chosen = ids(p);
    const newIds = chosen.map(() => p.newId());
    // The copies are the new ids that were not copied away: those that exist once the gesture is applied.
    if (p.apply(duplicateMany(p.canvas, chosen, newIds))) p.select({ ids: newIds.filter((i) => p.page.blocks.some((b) => b.id === i)), anchor: newIds[0] });
  },
  delete: (p) => { if (p.apply(removeMany(p.canvas, ids(p)))) p.select({ ids: [] }); },
  selectAll: (p) => p.select(selectAll(p.page)),
  selectSameKind: (p) => { const first = p.selection.ids[0]; if (first) p.select(selectSameKind(p.page, first)); },
  alignLeft: aligner("LEFT"), alignCenter: aligner("CENTER"), alignRight: aligner("RIGHT"), alignTop: aligner("TOP"), alignMiddle: aligner("MIDDLE"), alignBottom: aligner("BOTTOM"),
  distributeH: (p) => void p.apply(distribute(p.canvas, ids(p), "HORIZONTAL")),
  distributeV: (p) => void p.apply(distribute(p.canvas, ids(p), "VERTICAL")),
  matchWidth: (p) => { const ref = p.selection.anchor ?? p.selection.ids[0]; if (ref) p.apply(matchSize(p.canvas, ids(p), ref, "WIDTH")); },
  matchHeight: (p) => { const ref = p.selection.anchor ?? p.selection.ids[0]; if (ref) p.apply(matchSize(p.canvas, ids(p), ref, "HEIGHT")); },
  bringToFront: orderer("FRONT"), sendToBack: orderer("BACK"), bringForward: orderer("FORWARD"), sendBackward: orderer("BACKWARD"),
  group: (p) => { const id = p.newId(); if (p.apply(groupBlocks(p.canvas, ids(p), id))) p.select({ ids: [id], anchor: id }); },
  ungroup: (p) => { const holder = p.selection.ids[0]; if (holder && p.apply(ungroup(p.canvas, holder))) p.select({ ids: [] }); },
  lock: (p) => void p.apply(setFlag(p.canvas, ids(p), "locked", true)),
  unlock: (p) => void p.apply(setFlag(p.canvas, ids(p), "locked", false)),
  hide: (p) => void p.apply(setFlag(p.canvas, ids(p), "hidden", true)),
  show: (p) => void p.apply(setFlag(p.canvas, ids(p), "hidden", false)),
  convert: (p) => { const id = p.selection.ids[0]; if (id) p.ui.convert(id); },
  zoomIn: (p) => p.view.zoomBy(1.1), zoomOut: (p) => p.view.zoomBy(1 / 1.1), zoomFit: (p) => p.view.zoomTo("fit"), zoom100: (p) => p.view.zoomTo(1),
  toggleGrid: (p) => p.view.toggleGrid(), toggleRulers: (p) => p.view.toggleRulers(),
  openPalette: (p) => p.ui.openPalette(), showShortcuts: (p) => p.ui.showShortcuts(),
  save: (p) => p.save(), preview: (p) => p.preview(),
};

/** Arrow-key nudging is not a palette command; it is a key rule of its own. */
export function nudgeSelection(p: EditorPort, direction: "LEFT" | "RIGHT" | "UP" | "DOWN", big: boolean): boolean {
  if (p.selection.ids.length === 0) return false;
  return p.apply(nudge(p.canvas, ids(p), direction, big));
}

/** Dragging a rectangle on empty space selects what it touches. */
export const selectByRectangle = (p: EditorPort, rect: { x: number; y: number; w: number; h: number }, add: boolean): void => p.select(marquee(p.page, rect, add ? p.selection : { ids: [] }));

export const missingHandlers = (): string[] => CANVAS_COMMANDS.filter((c) => !COMMAND_HANDLERS[c.id]).map((c) => c.id);
