import type { ReactNode } from "react";
import { toneFor, toneClasses, type Tone } from "@/lib/shared/tone";
import { cn } from "@/components/ui/cn";

export function Badge({
  tone = "neutral",
  children,
  className,
  title,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
        toneClasses[toneFor(tone)].badge,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({
  tone,
  label,
  title,
}: {
  tone: Tone;
  label: string;
  title?: string;
}) {
  return (
    <Badge tone={tone} title={title}>
      {label}
    </Badge>
  );
}
