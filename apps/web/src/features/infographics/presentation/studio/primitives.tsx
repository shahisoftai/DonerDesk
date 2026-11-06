"use client";

import { useId, type ReactNode } from "react";
import { INFOGRAPHIC_ICONS, iconById } from "@donordesk/domain/contexts/infographics/index.js";
import { cn } from "@/components/ui/cn";

/** A small heading above a group of controls in the side panels. */
export function PanelHeading({ children }: { children: ReactNode }) {
  return <h3 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</h3>;
}

/** A bordered group inside a panel, collapsible so a long editor stays short. */
export function Group({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-lg border border-slate-200 dark:border-white/10">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-slate-700 marker:text-slate-400 dark:text-slate-200">{title}</summary>
      <div className="space-y-3 border-t border-slate-100 p-3 dark:border-white/5">{children}</div>
    </details>
  );
}

/** A checkbox with its label beside it. */
export function Check({ checked, onChange, label, disabled, hint }: { checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean; hint?: string }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
        <input id={id} type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
        {label}
      </label>
      {hint && <p className="ml-6 mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/** Small icon button used in item lists (move, remove). The label is read by screen readers. */
export function MiniButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 dark:hover:bg-white/10 dark:hover:text-white">
      {children}
    </button>
  );
}

/** Draws one bundled icon at a size, in the current text colour. */
export function IconGlyph({ id, size = 20, className }: { id: string | undefined; size?: number; className?: string }) {
  const icon = iconById(id);
  if (!icon) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d={icon.path} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}

/** A grid of the bundled icons; choosing the chosen one again clears it. */
export function IconPicker({ value, onChange, disabled }: { value?: string; onChange: (id: string | undefined) => void; disabled?: boolean }) {
  return (
    <div role="group" aria-label="Icon" className="grid grid-cols-8 gap-1">
      {INFOGRAPHIC_ICONS.map((icon) => (
        <button
          key={icon.id}
          type="button"
          title={icon.label}
          aria-label={icon.label}
          aria-pressed={value === icon.id}
          disabled={disabled}
          onClick={() => onChange(value === icon.id ? undefined : icon.id)}
          className={cn("flex h-8 w-8 items-center justify-center rounded-md border text-slate-600 hover:border-brand-400 hover:text-brand-700 disabled:opacity-50", value === icon.id ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-950/30" : "border-slate-200 dark:border-white/10")}
        >
          <IconGlyph id={icon.id} size={18} />
        </button>
      ))}
    </div>
  );
}

/**
 * A list of editable rows (figures, stages, messages, events, sectors, notes): add, remove and reorder.
 * Rendering one row is the caller's; the list owns only the structure, so every block edits lists the same way.
 */
export function ListEditor<T>({ items, onChange, render, make, max, addLabel, disabled, itemLabel }: { items: T[]; onChange: (next: T[]) => void; render: (item: T, update: (patch: Partial<T>) => void, index: number) => ReactNode; make: () => T; max: number; addLabel: string; disabled?: boolean; itemLabel: string }) {
  const move = (from: number, to: number): void => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved as T);
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="rounded-lg border border-slate-200 p-2 dark:border-white/10">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              {itemLabel} {index + 1}
            </span>
            {!disabled && (
              <span className="flex">
                <MiniButton label={`Move ${itemLabel.toLowerCase()} ${index + 1} up`} onClick={() => move(index, index - 1)} disabled={index === 0}>
                  ↑
                </MiniButton>
                <MiniButton label={`Move ${itemLabel.toLowerCase()} ${index + 1} down`} onClick={() => move(index, index + 1)} disabled={index === items.length - 1}>
                  ↓
                </MiniButton>
                <MiniButton label={`Remove ${itemLabel.toLowerCase()} ${index + 1}`} onClick={() => onChange(items.filter((_, i) => i !== index))}>
                  ✕
                </MiniButton>
              </span>
            )}
          </div>
          {render(item, (patch) => onChange(items.map((x, i) => (i === index ? { ...x, ...patch } : x))), index)}
        </div>
      ))}
      {!disabled && items.length < max && (
        <button type="button" className="w-full rounded-lg border border-dashed border-slate-300 py-1.5 text-sm text-brand-700 dark:text-brand-300" onClick={() => onChange([...items, make()])}>
          + {addLabel}
        </button>
      )}
    </div>
  );
}

/** A thumbnail of an uploaded image from the library. */
export function AssetThumb({ id, className, alt = "" }: { id: string; className?: string; alt?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/api/infographic-studio/infographic-assets/${encodeURIComponent(id)}/file`} alt={alt} loading="lazy" className={cn("object-cover", className)} />;
}
