/** Lower-case letters and digits joined by single hyphens, with none at either end; empty when nothing usable is left. */
export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
