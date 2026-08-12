import type { ReactNode } from "react";
import { toneFor, type Tone } from "@/lib/shared/tone";

const bannerStyles: Record<Tone, string> = {
  neutral: "border-slate-300/60 bg-slate-100/80 text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-300",
  info: "border-brand-500/30 bg-brand-100/80 text-brand-800 dark:border-brand-400/20 dark:bg-brand-400/15 dark:text-brand-200",
  success: "border-success-500/30 bg-success-100/80 text-success-800 dark:border-success-500/20 dark:bg-success-500/15 dark:text-success-300",
  warning: "border-warning-500/30 bg-warning-100/80 text-warning-800 dark:border-warning-500/20 dark:bg-warning-500/15 dark:text-warning-300",
  danger: "border-danger-500/30 bg-danger-100/80 text-danger-800 dark:border-danger-500/20 dark:bg-danger-500/15 dark:text-danger-300",
  ai: "border-ai-500/30 bg-ai-100/80 text-ai-800 dark:border-ai-500/20 dark:bg-ai-500/15 dark:text-ai-300",
};

export function Banner({
  tone = "info",
  title,
  children,
}: {
  tone?: Tone;
  title: string;
  children?: ReactNode;
}) {
  const t = toneFor(tone);
  return (
    <div role="status" className={`flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3 text-sm ${bannerStyles[t]}`}>
      <span className="font-semibold">{title}</span>
      {children}
    </div>
  );
}
