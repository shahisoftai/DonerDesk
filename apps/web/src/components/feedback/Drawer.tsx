"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Maximize2, X } from "lucide-react";
import { trapFocus } from "./Dialog";

type Side = "left" | "right" | "bottom";
export type DrawerSize = "sm" | "md" | "lg" | "xl";

/** Where the panel sits, open and shut. Side panels float 8 px in from the edges from the small breakpoint up. */
const PANEL_POSITION: Record<Side, { base: string; shut: string }> = {
  left: { base: "inset-y-0 start-0 sm:inset-y-2 sm:start-2 sm:rounded-2xl", shut: "-translate-x-[calc(100%+1rem)] rtl:translate-x-[calc(100%+1rem)]" },
  right: { base: "inset-y-0 end-0 sm:inset-y-2 sm:end-2 sm:rounded-2xl", shut: "translate-x-[calc(100%+1rem)] rtl:-translate-x-[calc(100%+1rem)]" },
  bottom: { base: "inset-x-0 bottom-0 max-h-[88vh] rounded-t-2xl", shut: "translate-y-full" },
};

export const DRAWER_WIDTH: Record<DrawerSize, string> = {
  sm: "w-[22rem]",
  md: "w-[28rem]",
  lg: "w-[36rem]",
  xl: "w-[52rem]",
};

/**
 * Stacked panels (Version 4.000, plan F67). Every open side panel takes a place in one stack; the one on top is the active one,
 * the ones below step back (slightly smaller, shifted, dimmed) and the top one shows "Back", which closes only itself.
 */
type StackListener = () => void;
const stack: string[] = [];
const listeners = new Set<StackListener>();
const notify = () => listeners.forEach((l) => l());
function useStackDepth(id: string, open: boolean): { depth: number; below: number } {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  useEffect(() => {
    if (!open) return;
    stack.push(id);
    notify();
    return () => { const i = stack.lastIndexOf(id); if (i >= 0) stack.splice(i, 1); notify(); };
  }, [id, open]);
  const at = stack.lastIndexOf(id);
  return { depth: at, below: at < 0 ? 0 : stack.length - 1 - at };
}

/** How long the slide takes; the panel stays mounted this long after closing so it can leave. */
export const DRAWER_EXIT_MS = 220;

/** Shared look of every slide-over (the Drawer, the plan's panel route). */
export const DRAWER_SURFACE =
  "flex flex-col overflow-hidden bg-white shadow-panel outline-none transition-transform duration-[220ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none dark:bg-[#121a2b] dark:shadow-[0_24px_64px_-12px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.08)]";
export const DRAWER_SCRIM =
  "bg-slate-950/40 backdrop-blur-[3px] transition-opacity duration-200 motion-reduce:transition-none";

/**
 * Modal side panel (or bottom sheet on small screens). It slides in, focus moves into it, stays trapped while open
 * and returns to the trigger on close; the body scrolls when the content is long and the footer stays in view. With
 * `dirty`, closing first asks whether to discard the changes.
 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  side = "right",
  wide = false,
  size,
  dirty = false,
  pageHref,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** One line under the title. */
  description?: ReactNode;
  /** Actions kept at the bottom of the panel (Save, Cancel). */
  footer?: ReactNode;
  children: ReactNode;
  side?: Side;
  /** A wider side panel (e.g. the report inspector). Same as `size="md"`. */
  wide?: boolean;
  size?: DrawerSize;
  /** Unsaved changes: closing asks first. */
  dirty?: boolean;
  /** The same content as a full page ("Open as page"). */
  pageHref?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const [asking, setAsking] = useState(false);
  const { depth, below } = useStackDepth(titleId, open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setAsking(false);
      const frame = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(frame);
    }
    setShown(false);
    const timer = window.setTimeout(() => setMounted(false), DRAWER_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  const requestClose = useCallback(() => {
    if (dirty) setAsking(true);
    else onClose();
  }, [dirty, onClose]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = panelRef.current;
    panel?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Only the panel on top answers Escape.
        if (stack[stack.length - 1] !== titleId) return;
        event.preventDefault();
        requestClose();
      } else if (panel && stack[stack.length - 1] === titleId) {
        trapFocus(panel, event);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open, requestClose]);

  if (!mounted) return null;

  const width = side === "bottom" ? "" : `${DRAWER_WIDTH[size ?? (wide ? "md" : "sm")]} max-w-[100vw] sm:max-w-[calc(100vw-1rem)]`;
  const position = PANEL_POSITION[side];
  // A panel with others on top of it steps back; the scrim is drawn once, by the bottom panel.
  const stepBack = below > 0 ? "sm:-translate-x-6 sm:scale-[0.98] sm:opacity-70 rtl:sm:translate-x-6" : "";
  return (
    <div className="fixed inset-0 z-50" role="presentation" style={{ zIndex: 50 + Math.max(0, depth) }}>
      <div className={`absolute inset-0 ${depth > 0 ? "bg-transparent" : DRAWER_SCRIM} ${shown ? "opacity-100" : "opacity-0"}`} onClick={requestClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`absolute ${DRAWER_SURFACE} ${position.base} ${width} ${shown ? `translate-x-0 translate-y-0 ${stepBack}` : position.shut}`}
        aria-hidden={below > 0 || undefined}
      >
        {side === "bottom" && <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-300 dark:bg-white/20" aria-hidden="true" />}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-3.5 dark:border-white/10">
          {depth > 0 && side !== "bottom" && (
            <button type="button" aria-label="Back" title="Back" className="btn-ghost btn-icon -ms-2 mt-0.5 shrink-0" onClick={requestClose}>
              <ArrowLeft aria-hidden="true" className="rtl:rotate-180" />
            </button>
          )}
          <div className="min-w-0 flex-1 pt-1">
            <h2 id={titleId} className="truncate text-[15px] font-semibold tracking-[-0.01em] text-slate-950 dark:text-white">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
                {description}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {pageHref && (
              <Link href={pageHref} className="btn-ghost btn-icon max-sm:hidden" aria-label="Open as page" title="Open as page">
                <Maximize2 aria-hidden="true" />
              </Link>
            )}
            <button type="button" aria-label="Close" title="Close (Esc)" className="btn-ghost h-11 w-11 p-0 sm:h-9 sm:w-9" onClick={requestClose}>
              <X aria-hidden="true" />
            </button>
          </div>
        </div>
        {asking && (
          <div role="alertdialog" aria-label="Discard changes?" className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-5 py-2.5 text-sm text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
            <span>You have changes that are not saved.</span>
            <span className="flex gap-2">
              <button type="button" className="btn-secondary btn-sm" onClick={() => setAsking(false)} autoFocus>Keep editing</button>
              <button type="button" className="btn-danger btn-sm" onClick={() => { setAsking(false); onClose(); }}>Discard</button>
            </span>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/80 px-5 py-3 dark:border-white/10 dark:bg-white/[0.03]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
