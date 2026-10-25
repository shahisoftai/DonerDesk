/**
 * The bundled icon set (Phase 32.3): simple, solid, single-path glyphs on a 24×24 grid, drawn for
 * this product (no third-party artwork, no agency marks). A design names an icon by id; the
 * composer and the Studio both draw it from these paths, so nothing is fetched and nothing can be
 * swapped for a tracking image. Paths use even-odd fill so holes (windows, rings) cut out.
 *
 * Humanitarian sector icons are kept simple on purpose: a plain pictogram reads better than a
 * detailed one at 24 px, in print and in greyscale.
 */
export interface InfographicIcon {
  id: string;
  label: string;
  /** The sector or use it is meant for (the picker groups by this). */
  group: "SECTOR" | "PEOPLE" | "GENERAL";
  /** SVG path data on a 24×24 viewBox, filled with even-odd. */
  path: string;
}

export const INFOGRAPHIC_ICONS: readonly InfographicIcon[] = [
  { id: "water", label: "Water and sanitation", group: "SECTOR", path: "M12 2.5c-3.2 4.3-6.5 8-6.5 12a6.5 6.5 0 0 0 13 0c0-4-3.3-7.7-6.5-12z" },
  { id: "health", label: "Health", group: "SECTOR", path: "M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" },
  { id: "nutrition", label: "Nutrition", group: "SECTOR", path: "M20 4C10 4 4 9 4 16c0 1.5.4 2.8 1 4 1-4 4-7 8-9-3 3-5 6-5.6 9.4.8.4 1.6.6 2.6.6 7 0 10-7 10-17z" },
  { id: "food", label: "Food security", group: "SECTOR", path: "M3 11h18a9 9 0 0 1-18 0zM8 2.5h2V8H8zm6 0h2V8h-2z" },
  { id: "education", label: "Education", group: "SECTOR", path: "M4 5.5C4 4.7 4.7 4 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5zM13 4h5.5c.8 0 1.5.7 1.5 1.5v15a1.5 1.5 0 0 0-1.5-1.5H13z" },
  { id: "shelter", label: "Shelter", group: "SECTOR", path: "M12 3 2 12h3v9h5v-6h4v6h5v-9h3z" },
  { id: "tent", label: "Camp and displacement", group: "SECTOR", path: "M12 3 2 20h20zM12 10l-4 10h8z" },
  { id: "protection", label: "Protection", group: "SECTOR", path: "M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" },
  { id: "livelihood", label: "Livelihoods", group: "SECTOR", path: "M9 3h6v3h6v13H3V6h6zm2 2v1h2V5z" },
  { id: "logistics", label: "Logistics", group: "SECTOR", path: "M2 6h12v9H2zM14 9h4l3 3v3h-7zM6.5 20a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm11 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" },
  { id: "coordination", label: "Coordination", group: "SECTOR", path: "M5 3h14v18H5zM8 6v2h2V6zm4 0v2h2V6zM8 10v2h2v-2zm4 0v2h2v-2zM8 14v2h2v-2zm4 0v2h2v-2z" },
  { id: "power", label: "Energy", group: "SECTOR", path: "M13 2 4 14h6l-1 8 9-12h-6z" },
  { id: "people", label: "People", group: "PEOPLE", path: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm7 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM9 13c-3.3 0-7 1.7-7 4.5V20h14v-2.5c0-2.8-3.7-4.5-7-4.5zm7.2.1c.9.7 1.8 1.8 1.8 3.4V20h4v-2.5c0-2.1-3-3.8-5.8-4.4z" },
  { id: "child", label: "Children", group: "PEOPLE", path: "M12 2.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM8 21v-7H6v-3.5C6 9.7 6.7 9 7.5 9h9c.8 0 1.5.7 1.5 1.5V14h-2v7h-2.5v-4h-1v4z" },
  { id: "heart", label: "Care", group: "PEOPLE", path: "M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z" },
  { id: "pin", label: "Location", group: "GENERAL", path: "M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" },
  { id: "coin", label: "Funding", group: "GENERAL", path: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12z" },
  { id: "calendar", label: "Dates", group: "GENERAL", path: "M7 2h2v2h6V2h2v2h3v18H4V4h3zm-1 7v11h12V9z" },
  { id: "chart", label: "Results", group: "GENERAL", path: "M4 20V4h2v14h14v2zM8 16v-5h3v5zm5 0V8h3v8zm5 0v-3h3v3z" },
  { id: "check", label: "Achieved", group: "GENERAL", path: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.5 14.5L6 12l1.4-1.4 3.1 3.1 6.1-6.1L18 9z" },
  { id: "warning", label: "Risk", group: "GENERAL", path: "M12 2 1 21h22zM11 10h2v5h-2zm0 6h2v2h-2z" },
  { id: "clock", label: "Timing", group: "GENERAL", path: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 5v5.4l3.5 2.1-1 1.7L11 13V7z" },
  { id: "trend-up", label: "Increase", group: "GENERAL", path: "M12 3l7 8h-4.5v10h-5V11H5z" },
  { id: "trend-down", label: "Decrease", group: "GENERAL", path: "M12 21l-7-8h4.5V3h5v10H19z" },
];

const BY_ID = new Map(INFOGRAPHIC_ICONS.map((icon) => [icon.id, icon]));

export function iconById(id: string | undefined): InfographicIcon | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/** A positioned, coloured icon as an SVG fragment (24-unit glyph scaled to `size` px). */
export function iconSvg(id: string | undefined, x: number, y: number, size: number, fill: string): string {
  const icon = iconById(id);
  if (!icon) return "";
  const scale = size / 24;
  return `<path d="${icon.path}" transform="translate(${x} ${y}) scale(${scale})" fill="${fill}" fill-rule="evenodd"/>`;
}
