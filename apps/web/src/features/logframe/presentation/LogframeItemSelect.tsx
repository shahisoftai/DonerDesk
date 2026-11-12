"use client";

import { Select } from "@/components/ui/Select";
import { useLevelName } from "./FrameworkVocabularyProvider";
import { outlineLogframe, type OutlineSource } from "@/features/logframe/domain/logframe-outline";

/** Dropdown of logframe items in hierarchy order, indented by depth. */
export function LogframeItemSelect({
  id,
  items,
  value,
  onChange,
  emptyLabel,
  required,
  selectableLevels,
}: {
  id: string;
  items: readonly OutlineSource[];
  value: string;
  onChange: (value: string) => void;
  emptyLabel: string;
  required?: boolean;
  /** When given, only items at these levels can be chosen; the others stay in the list for context but are disabled. */
  selectableLevels?: readonly string[];
}) {
  const levelName = useLevelName();
  return (
    <Select id={id} value={value} onChange={(event) => onChange(event.target.value)} required={required}>
      <option value="">{emptyLabel}</option>
      {outlineLogframe(items).map(({ item, depth }) => (
        <option key={item.id} value={item.id} disabled={selectableLevels ? !selectableLevels.includes(item.level) : false}>
          {"  ".repeat(depth)}
          {levelName(item.level)}
          {item.code ? ` ${item.code}` : ""} — {item.title}
        </option>
      ))}
    </Select>
  );
}
