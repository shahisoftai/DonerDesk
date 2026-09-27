"use client";

import { Select } from "@/components/ui/Select";
import { LOGFRAME_LEVEL_LABEL } from "@/lib/labels";
import { outlineLogframe, type OutlineSource } from "@/features/logframe/domain/logframe-outline";

/** Dropdown of logframe items in hierarchy order, indented by depth. */
export function LogframeItemSelect({
  id,
  items,
  value,
  onChange,
  emptyLabel,
  required,
}: {
  id: string;
  items: readonly OutlineSource[];
  value: string;
  onChange: (value: string) => void;
  emptyLabel: string;
  required?: boolean;
}) {
  return (
    <Select id={id} value={value} onChange={(event) => onChange(event.target.value)} required={required}>
      <option value="">{emptyLabel}</option>
      {outlineLogframe(items).map(({ item, depth }) => (
        <option key={item.id} value={item.id}>
          {"  ".repeat(depth)}
          {LOGFRAME_LEVEL_LABEL[item.level] ?? item.level}
          {item.code ? ` ${item.code}` : ""} — {item.title}
        </option>
      ))}
    </Select>
  );
}
