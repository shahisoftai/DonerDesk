"use client";

import { useEffect, useRef } from "react";
import { isTypingTarget, shortcutFor, type ShortcutAction } from "../application/shortcuts";

/**
 * Single-key report editor shortcuts (Report Editor U19), ignored while the
 * user types, inside dialogs and menus, or when a modifier is held.
 */
export function useEditorShortcuts(enabled: boolean, onShortcut: (action: ShortcutAction) => void) {
  const handlerRef = useRef(onShortcut);
  handlerRef.current = onShortcut;

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTypingTarget(event.target instanceof Element ? event.target : null)) return;
      const action = shortcutFor(event);
      if (!action) return;
      event.preventDefault();
      handlerRef.current(action);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
