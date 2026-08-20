import type { ReactNode } from "react";
import { toneFor, type Tone } from "@/lib/shared/tone";

const alertStyles: Record<Tone, string> = {
  neutral: "border-slate-300/60 bg-slate-50/80 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300",
  info: "border-brand-500/30 bg-brand-50/70 text-brand-800 dark:border-brand-400/20 dark:bg-brand-400/10 dark:text-brand-200",
  success: "border-success-500/30 bg-success-50/70 text-success-800 dark:border-success-500/20 dark:bg-success-500/10 dark:text-success-300",
  warning: "border-warning-500/30 bg-warning-50/70 text-warning-800 dark:border-warning-500/20 dark:bg-warning-500/10 dark:text-warning-300",
  danger: "border-danger-500/30 bg-danger-50/70 text-danger-800 dark:border-danger-500/20 dark:bg-danger-500/10 dark:text-danger-300",
  ai: "border-ai-500/30 bg-ai-50/70 text-ai-800 dark:border-ai-500/20 dark:bg-ai-500/10 dark:text-ai-300",
};

export function InlineAlert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  const t = toneFor(tone);
  return (
    <div role="alert" className={`rounded-xl border p-3 text-sm ${alertStyles[t]} ${className ?? ""}`}>
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 text-sm opacity-90">{children}</div>}
    </div>
  );
}
