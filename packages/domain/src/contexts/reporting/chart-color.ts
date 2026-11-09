/** Small colour helpers for charts (Phase 47). Pure; `#rrggbb` in, `#rrggbb` out. */

const clamp = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));
export const hexToRgb = (hex: string): [number, number, number] => [Number.parseInt(hex.slice(1, 3), 16), Number.parseInt(hex.slice(3, 5), 16), Number.parseInt(hex.slice(5, 7), 16)];
export const rgbToHex = (r: number, g: number, b: number): string => `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("")}`;

/** `a` moved `t` (0 to 1) of the way toward `b`. */
export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}
