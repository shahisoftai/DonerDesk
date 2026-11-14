/** Header words folded for matching in any of the four languages: lower case, no accents, separators as spaces. */
export function headerWords(header: string): string[] {
  return header
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9؀-ۿ]+/)
    .filter(Boolean);
}

/** True when any of the phrases appears as whole words in the header ("health facility" in "Name of health facility"). */
export function headerHas(header: string, phrases: readonly string[]): string | undefined {
  const words = headerWords(header);
  const joined = ` ${words.join(" ")} `;
  return phrases.find((p) => joined.includes(` ${headerWords(p).join(" ")} `));
}
