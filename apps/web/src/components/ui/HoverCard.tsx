import type { ReactNode } from "react";

/**
 * A small preview shown when a person points at or focuses a name (Version 4.000, plan F74). Pure CSS (group hover and
 * focus-within), so it works in server components and costs no script; the trigger keeps its own link and keyboard behaviour.
 */
export function HoverCard({ trigger, children, align = "start" }: { trigger: ReactNode; children: ReactNode; align?: "start" | "end" }) {
  return (
    <span className="group/hc relative inline-block max-w-full">
      {trigger}
      <span
        role="tooltip"
        className={`pointer-events-none invisible absolute top-full z-30 mt-2 w-72 translate-y-1 rounded-xl border border-slate-200 bg-white p-3 text-start text-[13px] font-normal text-slate-700 opacity-0 shadow-raised transition duration-150 group-focus-within/hc:visible group-focus-within/hc:translate-y-0 group-focus-within/hc:opacity-100 group-hover/hc:visible group-hover/hc:translate-y-0 group-hover/hc:opacity-100 motion-reduce:transition-none dark:border-white/10 dark:bg-[#16203a] dark:text-slate-200 ${align === "end" ? "end-0" : "start-0"}`}
      >
        {children}
      </span>
    </span>
  );
}
