/**
 * Every editing command in one table (Phase 48.1). The command palette (⌘K), the shortcut sheet, the right-click menu, the toolbar and
 * the keyboard handler all read this list, so a command has one name, one shortcut and one rule for when it is available. A command
 * is only data: the editor maps its id to a gesture in `arrange.ts`, `structure.ts` or `edit.ts`. Pure; no DOM.
 */
export const COMMAND_GROUPS = ["EDIT", "ARRANGE", "ORDER", "BLOCK", "VIEW", "FILE"] as const;
export type CommandGroup = (typeof COMMAND_GROUPS)[number];

/** What a command needs before it can run. */
export const COMMAND_NEEDS = ["NONE", "ONE", "MANY", "THREE", "CLIPBOARD", "UNDO", "REDO", "GROUP", "CONTAINER"] as const;
export type CommandNeed = (typeof COMMAND_NEEDS)[number];

export interface CanvasCommand {
  id: string;
  /** Catalogue key of the command's name (`studio.cmd.<id>`); the words themselves are in the four-language catalogue. */
  group: CommandGroup;
  /** "Mod" is ⌘ on a Mac and Ctrl elsewhere. Absent = no shortcut (palette and menu only). */
  shortcut?: string;
  needs: CommandNeed;
  /** Words (any language is fine) the palette also matches, besides the translated name. */
  keywords: readonly string[];
}

export const CANVAS_COMMANDS: readonly CanvasCommand[] = [
  { id: "undo", group: "EDIT", shortcut: "Mod+Z", needs: "UNDO", keywords: ["back", "revert"] },
  { id: "redo", group: "EDIT", shortcut: "Mod+Shift+Z", needs: "REDO", keywords: ["forward", "again"] },
  { id: "copy", group: "EDIT", shortcut: "Mod+C", needs: "ONE", keywords: ["clipboard"] },
  { id: "cut", group: "EDIT", shortcut: "Mod+X", needs: "ONE", keywords: ["clipboard"] },
  { id: "paste", group: "EDIT", shortcut: "Mod+V", needs: "CLIPBOARD", keywords: ["clipboard"] },
  { id: "duplicate", group: "EDIT", shortcut: "Mod+D", needs: "ONE", keywords: ["copy", "clone"] },
  { id: "delete", group: "EDIT", shortcut: "Delete", needs: "ONE", keywords: ["remove", "erase"] },
  { id: "selectAll", group: "EDIT", shortcut: "Mod+A", needs: "NONE", keywords: ["everything"] },
  { id: "selectSameKind", group: "EDIT", needs: "ONE", keywords: ["similar", "same type"] },
  { id: "alignLeft", group: "ARRANGE", shortcut: "Alt+A", needs: "MANY", keywords: ["align"] },
  { id: "alignCenter", group: "ARRANGE", shortcut: "Alt+H", needs: "MANY", keywords: ["align", "middle"] },
  { id: "alignRight", group: "ARRANGE", shortcut: "Alt+D", needs: "MANY", keywords: ["align"] },
  { id: "alignTop", group: "ARRANGE", shortcut: "Alt+W", needs: "MANY", keywords: ["align"] },
  { id: "alignMiddle", group: "ARRANGE", shortcut: "Alt+V", needs: "MANY", keywords: ["align", "centre"] },
  { id: "alignBottom", group: "ARRANGE", shortcut: "Alt+S", needs: "MANY", keywords: ["align"] },
  { id: "distributeH", group: "ARRANGE", shortcut: "Alt+Shift+H", needs: "THREE", keywords: ["space", "even"] },
  { id: "distributeV", group: "ARRANGE", shortcut: "Alt+Shift+V", needs: "THREE", keywords: ["space", "even"] },
  { id: "matchWidth", group: "ARRANGE", needs: "MANY", keywords: ["same size", "resize"] },
  { id: "matchHeight", group: "ARRANGE", needs: "MANY", keywords: ["same size", "resize"] },
  { id: "bringToFront", group: "ORDER", shortcut: "Mod+Shift+]", needs: "ONE", keywords: ["order", "top"] },
  { id: "sendToBack", group: "ORDER", shortcut: "Mod+Shift+[", needs: "ONE", keywords: ["order", "bottom"] },
  { id: "bringForward", group: "ORDER", shortcut: "Mod+]", needs: "ONE", keywords: ["order"] },
  { id: "sendBackward", group: "ORDER", shortcut: "Mod+[", needs: "ONE", keywords: ["order"] },
  { id: "group", group: "BLOCK", shortcut: "Mod+G", needs: "MANY", keywords: ["combine", "frame"] },
  { id: "ungroup", group: "BLOCK", shortcut: "Mod+Shift+G", needs: "CONTAINER", keywords: ["split", "frame"] },
  { id: "lock", group: "BLOCK", shortcut: "Mod+L", needs: "ONE", keywords: ["protect", "freeze"] },
  { id: "unlock", group: "BLOCK", shortcut: "Mod+Shift+L", needs: "ONE", keywords: ["protect", "unfreeze"] },
  { id: "hide", group: "BLOCK", shortcut: "Mod+H", needs: "ONE", keywords: ["visible"] },
  { id: "show", group: "BLOCK", shortcut: "Mod+Shift+H", needs: "ONE", keywords: ["visible"] },
  { id: "convert", group: "BLOCK", needs: "ONE", keywords: ["change kind", "replace", "turn into"] },
  { id: "zoomIn", group: "VIEW", shortcut: "Mod+=", needs: "NONE", keywords: ["bigger"] },
  { id: "zoomOut", group: "VIEW", shortcut: "Mod+-", needs: "NONE", keywords: ["smaller"] },
  { id: "zoomFit", group: "VIEW", shortcut: "Shift+1", needs: "NONE", keywords: ["fit", "whole page"] },
  { id: "zoom100", group: "VIEW", shortcut: "Shift+0", needs: "NONE", keywords: ["actual size"] },
  { id: "toggleGrid", group: "VIEW", shortcut: "Mod+'", needs: "NONE", keywords: ["guides", "columns"] },
  { id: "toggleRulers", group: "VIEW", shortcut: "Mod+Shift+R", needs: "NONE", keywords: ["guides"] },
  { id: "openPalette", group: "VIEW", shortcut: "Mod+K", needs: "NONE", keywords: ["search", "command", "find"] },
  { id: "showShortcuts", group: "VIEW", shortcut: "?", needs: "NONE", keywords: ["help", "keys"] },
  { id: "save", group: "FILE", shortcut: "Mod+S", needs: "NONE", keywords: ["keep"] },
  { id: "preview", group: "FILE", shortcut: "Mod+P", needs: "NONE", keywords: ["view as", "present"] },
];

export interface EditorState {
  selectedCount: number;
  /** The one selected block is a container (a group, tabs, a repeater). */
  selectedIsContainer: boolean;
  canUndo: boolean;
  canRedo: boolean;
  hasClipboard: boolean;
}

const MIN_FOR: Record<CommandNeed, (s: EditorState) => boolean> = {
  NONE: () => true,
  ONE: (s) => s.selectedCount >= 1,
  MANY: (s) => s.selectedCount >= 2,
  THREE: (s) => s.selectedCount >= 3,
  CLIPBOARD: (s) => s.hasClipboard,
  UNDO: (s) => s.canUndo,
  REDO: (s) => s.canRedo,
  GROUP: (s) => s.selectedCount >= 2,
  CONTAINER: (s) => s.selectedCount === 1 && s.selectedIsContainer,
};

export const commandEnabled = (command: CanvasCommand, state: EditorState): boolean => MIN_FOR[command.needs](state);

export interface KeyLike { key: string; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; altKey?: boolean }

/** True when a key event is this shortcut. "Mod" is ⌘ or Ctrl, either one. */
export function matchesShortcut(shortcut: string, e: KeyLike): boolean {
  const parts = shortcut.split("+");
  const key = parts.at(-1)!;
  const want = { mod: parts.includes("Mod"), shift: parts.includes("Shift"), alt: parts.includes("Alt") };
  const mod = Boolean(e.ctrlKey || e.metaKey);
  // A shifted symbol key is reported as the symbol itself; only letters and the arrows need the shift flag to match.
  const isLetterOrNamed = key.length > 1 || /[a-z]/i.test(key);
  if (mod !== want.mod || Boolean(e.altKey) !== want.alt) return false;
  if (isLetterOrNamed && Boolean(e.shiftKey) !== want.shift) return false;
  return e.key.toLowerCase() === key.toLowerCase();
}

/** The command a key event runs, if it is available now. */
export function commandForKey(e: KeyLike, state: EditorState): CanvasCommand | undefined {
  return CANVAS_COMMANDS.find((c) => c.shortcut && matchesShortcut(c.shortcut, e) && commandEnabled(c, state));
}

/** Shows a shortcut the way the person's computer writes it. */
export function shortcutLabel(shortcut: string, mac: boolean): string {
  return shortcut.split("+").map((p) => (p === "Mod" ? (mac ? "⌘" : "Ctrl") : p === "Alt" ? (mac ? "⌥" : "Alt") : p === "Shift" ? (mac ? "⇧" : "Shift") : p)).join(mac ? "" : "+");
}

/** Palette search: every word must start a word in the command's name or one of its keywords; available commands come first. */
export function searchCommands(text: string, nameOf: (c: CanvasCommand) => string, state: EditorState): CanvasCommand[] {
  const wanted = text.toLowerCase().split(/\s+/).filter(Boolean);
  const words = (c: CanvasCommand) => `${nameOf(c)} ${c.keywords.join(" ")}`.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return CANVAS_COMMANDS.filter((c) => wanted.every((w) => words(c).some((x) => x.startsWith(w))))
    .sort((a, b) => Number(commandEnabled(b, state)) - Number(commandEnabled(a, state)));
}
