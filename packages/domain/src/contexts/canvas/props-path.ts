/** Reading and writing a value inside a block's settings by a dotted path ("spec.dataset.measure"); writing returns a copy and never changes the original. */
export function getAt(value: unknown, path: string): unknown {
  let at: unknown = value;
  for (const part of path.split(".")) {
    if (at === null || typeof at !== "object") return undefined;
    at = (at as Record<string, unknown>)[part];
  }
  return at;
}

export function setAt(value: unknown, path: string, next: unknown): unknown {
  const [head, ...rest] = path.split(".");
  const base = value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return { ...base, [head!]: rest.length === 0 ? next : setAt(base[head!], rest.join("."), next) };
}
