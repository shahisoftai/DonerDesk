"use client";

import { usePathname, useRouter } from "next/navigation";
import { REPORT_TYPE_LABEL } from "@/lib/labels";

/** Switches which reporting period the project overview shows readiness and compliance for. */
export function PeriodSwitcher({
  periods,
  value,
}: {
  periods: Array<{ id: string; reportType: string; status: string }>;
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
          {REPORT_TYPE_LABEL[p.reportType] ?? p.reportType} — {p.status.replace(/_/g, " ")}
        </option>
      ))}
    </select>
  );
}
