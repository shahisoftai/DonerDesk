"use client";

import { usePathname, useRouter } from "next/navigation";

/** Switches which reporting period the project overview shows readiness and compliance for. Each option is named by type and month. */
export function PeriodSwitcher({
  periods,
  value,
}: {
  periods: Array<{ id: string; label: string; status: string }>;
  value: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <select
      id="period-select"
      className="input mt-1 max-w-xs"
      value={value}
      onChange={(event) => router.push(`${pathname}?period=${encodeURIComponent(event.target.value)}`)}
    >
      {periods.map((p) => (
        <option key={p.id} value={p.id}>
          {p.label} — {p.status.replace(/_/g, " ")}
        </option>
      ))}
    </select>
  );
}
