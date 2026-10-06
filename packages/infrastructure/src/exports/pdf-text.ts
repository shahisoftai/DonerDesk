/**
 * The PDF uses the built-in Helvetica, which draws the WinAnsi (Windows Latin-1) characters only. Anything outside it
 * (arrows, "≥", non-breaking hyphens, emoji) comes out as a garbled glyph, so it is replaced by plain text first.
 */
const WIN_ANSI_EXTRAS = new Set([0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178]);

const REPLACEMENTS: ReadonlyArray<[RegExp, string]> = [
  [/[‐‑‒−]/g, "-"],
  [/→/g, "->"],
  [/←/g, "<-"],
  [/≥/g, ">="],
  [/≤/g, "<="],
  [/[✓✔]/g, "v"],
  [/[       ]/g, " "],
  [/[​‌‍﻿]/g, ""],
];

export function toPdfSafeText(text: string): string {
  let out = text;
  for (const [pattern, replacement] of REPLACEMENTS) out = out.replace(pattern, replacement);
  return Array.from(out, (ch) => {
    const code = ch.codePointAt(0)!;
    return code === 0x0a || (code >= 0x20 && code <= 0xff) || WIN_ANSI_EXTRAS.has(code) ? ch : "-";
  }).join("");
}
