"use client";

import { useId, type ReactNode } from "react";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { tileView, type TileStatus } from "@/features/design/domain/tile-view";
import { cn } from "./cn";

export interface TileAction { label: string; onSelect: () => void }

export interface TileProps {
  title: string;
  subtitle?: string;
  /** A short code shown as a badge before the title (an indicator code). */
  code?: string;
  status: TileStatus;
  /** The date the figures stand at, already formatted. */
  asOf?: string;
  unverified?: number;
  notFiltered?: boolean;
  onRetry?: () => void;
  /** Options shown in the ⋯ menu; none, no menu. */
  actions?: TileAction[];
  className?: string;
  /** Drawn only when the status is "ready". */
  children?: ReactNode;
}

/**
 * The one frame for a dashboard widget, home tile or map panel: title, optional code badge, options menu, a body that is the
 * content or one honest sentence (loading, not yet reported, could not load, from a project you cannot see), and a footer for the
 * as-of date and any values not verified yet. Colours come from the data-surface tokens, so it follows dark mode.
 */
export function Tile({ title, subtitle, code, status, asOf, unverified, notFiltered, onRetry, actions, className, children }: TileProps) {
  const { t, tp } = useI18n();
  const titleId = useId();
  const view = tileView({ status, unverified, asOf, notFiltered, canRetry: Boolean(onRetry) });
  return (
    <section aria-labelledby={titleId} aria-busy={status === "loading"} className={cn("flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--tile-border)] bg-[var(--tile-bg)] text-[var(--tile-title)] shadow-sm", className)}>
      <header className="flex items-start gap-3 border-b border-[var(--tile-border)] bg-[var(--tile-header-bg)] px-3 py-2">
        {code ? <span className="mt-0.5 shrink-0 rounded bg-[var(--badge-bg)] px-1.5 py-0.5 text-xs font-semibold text-[var(--badge-text)]">{code}</span> : null}
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="truncate text-sm font-semibold">{title}</h3>
          {subtitle ? <p className="truncate text-xs text-[var(--tile-meta)]">{subtitle}</p> : null}
        </div>
        {actions && actions.length > 0 ? (
          <details className="relative shrink-0">
            <summary aria-label={t("tile.menu", { title })} className="flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded text-[var(--tile-meta)] hover:bg-black/5 focus-visible:outline focus-visible:outline-2 dark:hover:bg-white/10">
              <span aria-hidden="true">⋯</span>
            </summary>
            <ul className="absolute end-0 z-10 mt-1 min-w-40 rounded-lg border border-[var(--tile-border)] bg-[var(--tile-bg)] py-1 shadow-lg">
              {actions.map((a) => (
                <li key={a.label}>
                  <button type="button" onClick={a.onSelect} className="block w-full px-3 py-1.5 text-start text-sm hover:bg-[var(--tile-header-bg)]">{a.label}</button>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </header>
      <div className="min-h-0 flex-1 p-3" aria-live={view.live}>
        {view.showContent ? children : (
          <div className="flex h-full min-h-16 flex-col items-center justify-center gap-1 text-center">
            <p className={cn("text-sm", status === "error" ? "text-[var(--signal-bad)]" : "text-[var(--tile-meta)]")}>{t(view.messageKey!)}</p>
            {view.hintKey ? <p className="text-xs text-[var(--tile-meta)]">{t(view.hintKey)}</p> : null}
            {view.showRetry ? <button type="button" onClick={onRetry} className="mt-1 rounded border border-[var(--tile-border)] px-2 py-1 text-xs hover:bg-[var(--tile-header-bg)]">{t("tile.retry")}</button> : null}
          </div>
        )}
      </div>
      {view.footer.length > 0 ? (
        <footer className="space-y-0.5 border-t border-[var(--tile-border)] px-3 py-1.5 text-xs text-[var(--tile-meta)]">
          {view.footer.map((f) => (
            <p key={f.key}>{f.count !== undefined ? tp(f.key, f.count) : t(f.key, f.asOf !== undefined ? { date: f.asOf } : undefined)}</p>
          ))}
        </footer>
      ) : null}
    </section>
  );
}
