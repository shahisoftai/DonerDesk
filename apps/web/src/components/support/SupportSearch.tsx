"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export interface SearchEntry {
  title: string;
  description: string;
  href: string;
  category: string;
}

const MAX_RESULTS = 8;

function score(entry: SearchEntry, terms: string[]): number {
  const title = entry.title.toLowerCase();
  const rest = `${entry.description} ${entry.category}`.toLowerCase();
  let total = 0;
  for (const t of terms) {
    if (title.includes(t)) total += title.startsWith(t) ? 4 : 3;
    else if (rest.includes(t)) total += 1;
    else return 0; // every word must match somewhere
  }
  return total;
}

export function SupportSearch({ entries }: { entries: SearchEntry[] }) {
  const [query, setQuery] = useState("");
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

  const results = useMemo(() => {
    if (terms.length === 0) return [];
    return entries
      .map((e) => ({ e, s: score(e, terms) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, MAX_RESULTS)
      .map((r) => r.e);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, query]);

  return (
    <div className="relative mx-auto mt-8 max-w-xl text-left">
      <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
        <svg className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
        </svg>
      </div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setQuery("");
          if (e.key === "Enter" && results[0]) window.location.href = results[0].href;
        }}
        aria-label="Search the Support Center"
        placeholder="Search guides, how-tos, donor requirements..."
        className="w-full rounded-xl border border-white/15 bg-white/5 py-3.5 pl-11 pr-4 text-sm text-white placeholder-slate-400 backdrop-blur focus:border-brand-400/60 focus:outline-none focus:ring-1 focus:ring-brand-400/40"
      />
      {terms.length > 0 && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-2 max-h-96 overflow-y-auto rounded-xl border border-white/15 bg-slate-900/95 p-1 shadow-2xl backdrop-blur"
        >
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">No guides match “{query.trim()}”. Try fewer or different words.</p>
          ) : (
            results.map((r) => (
              <Link
                key={r.href}
                href={r.href}
                role="option"
                aria-selected={false}
                className="block rounded-lg px-4 py-2.5 hover:bg-white/10"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-white">{r.title}</span>
                  <span className="shrink-0 text-[11px] text-slate-400">{r.category}</span>
                </span>
                <span className="mt-0.5 line-clamp-1 block text-xs text-slate-400">{r.description}</span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
