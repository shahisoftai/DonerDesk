/**
 * Report editor keyboard shortcuts (Report Editor U19). Single-key shortcuts
 * are ignored while the user types in a field or the rich-text editor, and
 * whenever a modifier is held, so they never clash with browser or editor
 * shortcuts. Pure.
 */

export type ShortcutAction = "next-section" | "prev-section" | "next-issue" | "prev-issue" | "edit" | "approve" | "help";

export const SHORTCUTS: ReadonlyArray<{ keys: string; action: ShortcutAction; label: string }> = [
  { keys: "j", action: "next-section", label: "Next section" },
  { keys: "k", action: "prev-section", label: "Previous section" },
  { keys: "n", action: "next-issue", label: "Next issue" },
  { keys: "Shift+N", action: "prev-issue", label: "Previous issue" },
  { keys: "e", action: "edit", label: "Edit the selected section" },
  { keys: "a", action: "approve", label: "Approve the selected section" },
  { keys: "?", action: "help", label: "Show keyboard shortcuts" },
];

const BY_KEY: Record<string, ShortcutAction> = {
  j: "next-section",
  k: "prev-section",
  n: "next-issue",
  N: "prev-issue",
  e: "edit",
  a: "approve",
  "?": "help",
};

export type KeyEventLike = { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean };

export function shortcutFor(event: KeyEventLike): ShortcutAction | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  return BY_KEY[event.key] ?? null;
}

export type TargetLike = { tagName?: string; isContentEditable?: boolean; closest?: (selector: string) => unknown } | null;

/** True when keystrokes belong to a text field, select or editable region. */
export function isTypingTarget(target: TargetLike): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName?.toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return Boolean(target.closest?.('[contenteditable="true"], [role="textbox"], [role="dialog"], [role="menu"]'));
}
