export function exhaustive(value: never): never {
  throw new Error(`Unhandled exhaustive case: ${String(value)}`);
}
