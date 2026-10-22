import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/data/Badge";
import type { NeedsYouItem } from "../domain/home-derive";

const NEED_BORDER = { danger: "border-l-danger-500", warning: "border-l-warning-500", info: "border-l-brand-500" } as const;

export function HomeHeader({ eyebrow, title, subtitle, actions }: { eyebrow: string; title: string; subtitle: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400">{eyebrow}</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-balance">{title}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function NeedsYouStrip({ items }: { items: ReadonlyArray<NeedsYouItem> }) {
  return (
    <section aria-label="Needs you" className="mt-6">
      <h2 className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Needs you</h2>
      {items.length === 0 ? (
        <p className="mt-2 rounded-lg border border-slate-200/70 bg-white px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">Nothing is waiting for you.</p>
      ) : (
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.slice(0, 4).map((n) => (
            <Link key={n.key} href={n.href} className={`flex min-w-0 items-start gap-3 rounded-lg border border-l-4 border-slate-200/70 bg-white px-3 py-3 transition hover:border-brand-400/40 dark:border-white/10 dark:bg-white/[0.03] ${NEED_BORDER[n.tone]}`}>
              <span className="text-2xl font-semibold tabular-nums leading-none">{n.count}</span>
              <span className="min-w-0">
                <span className="block break-words text-sm font-medium leading-5">{n.title}</span>
                <span className="block break-words text-xs leading-4 text-slate-500 dark:text-slate-400">{n.detail}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export function Tile({ label, value, hint, href }: { label: string; value: string; hint?: string; href: string }) {
  return (
    <Link href={href} className="card min-w-0 transition hover:border-brand-400/40 dark:hover:border-brand-400/30">
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
      {hint && <div className="mt-1 break-words text-xs text-slate-500 dark:text-slate-400">{hint}</div>}
    </Link>
  );
}

export function Panel({ title, href, linkLabel, children }: { title: string; href?: string; linkLabel?: string; children: ReactNode }) {
  return (
    <section className="min-w-0">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">{title}</h2>
        {href && <Link href={href} className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">{linkLabel ?? "View all →"}</Link>}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export type QuickLink = { href: string; label: string; hint?: string };

export function QuickLinks({ links }: { links: ReadonlyArray<QuickLink> }) {
  if (links.length === 0) return null;
  return (
    <Panel title="Quick links">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {links.map((l) => (
          <Link key={l.href + l.label} href={l.href} className="rounded-lg border border-slate-200/70 bg-white px-3 py-2.5 transition hover:border-brand-400/40 dark:border-white/10 dark:bg-white/[0.03]">
            <span className="block text-sm font-medium">{l.label}</span>
            {l.hint && <span className="block text-xs text-slate-500 dark:text-slate-400">{l.hint}</span>}
          </Link>
        ))}
      </div>
    </Panel>
  );
}

export function NotificationsList({ items }: { items: ReadonlyArray<{ id: string; title: string; message: string; read: boolean }> }) {
  if (items.length === 0) return <p className="text-sm text-slate-500 dark:text-slate-400">No notifications yet.</p>;
  return (
    <ul className="space-y-2">
      {items.slice(0, 4).map((n) => (
        <li key={n.id} className="rounded-lg border border-slate-200/60 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 break-words text-sm font-medium leading-5">{n.title}</span>
            <Badge tone={n.read ? "neutral" : "info"} className="shrink-0">{n.read ? "Read" : "New"}</Badge>
          </div>
          {n.message && <p className="mt-1 break-words text-xs leading-4 text-slate-500 dark:text-slate-400">{n.message}</p>}
        </li>
      ))}
    </ul>
  );
}
