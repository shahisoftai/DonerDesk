import type { ReactNode } from "react";

export function FilterBar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3" role="group" aria-label={label}>
      {children}
    </div>
  );
}
