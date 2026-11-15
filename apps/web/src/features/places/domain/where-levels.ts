/** The levels the organisation's Where we work page can be read at (Phase 56). Pure; an unknown address falls back to provinces. */
export const WHERE_LEVELS: ReadonlyArray<{ level: 1 | 2 | 3 | 4; label: string }> = [
  { level: 1, label: "Provinces" },
  { level: 2, label: "Districts" },
  { level: 3, label: "Sub-districts" },
  { level: 4, label: "Sites" },
];
export const levelOf = (value: string | undefined): 1 | 2 | 3 | 4 => WHERE_LEVELS.find((l) => String(l.level) === value)?.level ?? 1;
