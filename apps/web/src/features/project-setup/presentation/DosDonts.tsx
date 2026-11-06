"use client";

import type { ReactNode } from "react";
import { useSetupCopy } from "./useSetupCopy";

/** The do's and don'ts, side by side. The icons are decoration: the words carry the meaning. */
export function DosDonts({ dos, donts }: { dos: readonly string[]; donts: readonly string[] }) {
  const { c } = useSetupCopy();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Column tone="do" title={c.common.do} items={dos} />
      <Column tone="dont" title={c.common.dont} items={donts} />
    </div>
  );
}

function Column({ tone, title, items }: { tone: "do" | "dont"; title: string; items: readonly string[] }): ReactNode {
  const good = tone === "do";
  return (
    <section
      aria-label={title}
      className={`rounded-xl border p-4 ${good ? "border-green-500/25 bg-green-50 dark:border-green-400/20 dark:bg-green-400/5" : "border-red-500/25 bg-red-50 dark:border-red-400/20 dark:bg-red-400/5"}`}
    >
      <h3 className={`text-sm font-semibold ${good ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300"}`}>{title}</h3>
      <ul className="mt-2 space-y-2 text-sm text-slate-700 dark:text-slate-200">
        {items.map((text) => (
          <li key={text} className="flex gap-2">
            <span aria-hidden="true" className={`mt-0.5 shrink-0 font-bold ${good ? "text-green-600" : "text-red-600"}`}>{good ? "✓" : "✕"}</span>
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
