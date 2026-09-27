"use client";

import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { trapFocus } from "./Dialog";

const PANEL_POSITION: Record<"left" | "right" | "bottom", string> = {
  left: "left-0 top-0 h-full",
  right: "right-0 top-0 h-full",
  bottom: "inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl",
};

/**
 * Modal side panel (or bottom sheet on small screens). Focus moves into it,
 * stays trapped while open and returns to the trigger on close; the body
 * scrolls when the content is long.
 */
export function Drawer({
  open,
  onClose,
  title,
  children,
  side = "right",
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  side?: "left" | "right" | "bottom";
  /** A wider side panel (e.g. the report inspector). */
  wide?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = panelRef.current;
    panel?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (panel) {
        trapFocus(panel, event);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const width = side === "bottom" ? "" : wide ? "w-[26rem] max-w-[92vw]" : "w-80 max-w-[85vw]";
  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`absolute flex flex-col bg-white p-4 shadow-xl outline-none dark:bg-slate-900 ${PANEL_POSITION[side]} ${width}`}
      >
        <div className="flex shrink-0 items-center justify-between">
          <h2 id={titleId} className="text-sm font-medium">
            {title}
          </h2>
          <button type="button" aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/5" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
