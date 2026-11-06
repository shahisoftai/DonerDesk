/** Reading and writing a value inside nested settings by a dotted path ("spec.dataset.indicatorIds"). Pure; a write returns a copy, never changes the original. */
export function getAt(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((v, key) => (v && typeof v === "object" ? (v as Record<string, unknown>)[key] : undefined), source);
}

export function setAt<T>(source: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split(".");
  const base = (source && typeof source === "object" ? source : {}) as Record<string, unknown>;
  const next = { ...base };
  if (rest.length === 0) {
    // An emptied optional field is removed, so it is stored absent rather than as an empty string.
    if (value === undefined || value === "") delete next[head!]; else next[head!] = value;
  } else next[head!] = setAt(base[head!], rest.join("."), value);
  return next as T;
}
