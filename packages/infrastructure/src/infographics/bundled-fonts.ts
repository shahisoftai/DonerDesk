import { fileURLToPath } from "node:url";

/**
 * The extra font families that ship with the product (Phase 48.13), beside Liberation Sans and Noto Sans Arabic. Each is one family with a
 * regular and a bold file in `assets/fonts` (SIL OFL, licence file beside it). The domain's font table says `bundled: true` for exactly these
 * ids, and a test pins the two lists together, so a font the editor offers as "will look the same in a file" always has its file.
 * Italic is drawn with the regular face: no italic files are shipped.
 */
export interface BundledFont { id: string; family: string; regular: string; bold: string }

export const FONT_DIR = fileURLToPath(new URL("../../assets/fonts/", import.meta.url));

export const EXTRA_FONTS: readonly BundledFont[] = [
  { id: "lato", family: "Lato", regular: "Lato-Regular.ttf", bold: "Lato-Bold.ttf" },
  { id: "pt-sans", family: "PT Sans", regular: "PTSans-Regular.ttf", bold: "PTSans-Bold.ttf" },
  { id: "pt-serif", family: "PT Serif", regular: "PTSerif-Regular.ttf", bold: "PTSerif-Bold.ttf" },
  { id: "fira-sans", family: "Fira Sans", regular: "FiraSans-Regular.ttf", bold: "FiraSans-Bold.ttf" },
  { id: "poppins", family: "Poppins", regular: "Poppins-Regular.ttf", bold: "Poppins-Bold.ttf" },
];

/** The first family of a CSS font-family value, without quotes: `"Lato", system-ui, sans-serif` is Lato. */
export const firstFamily = (value: string): string => (value.split(",")[0] ?? "").trim().replace(/^['"]|['"]$/g, "").trim();

/** The bundled extra font a font-family value names first, if any. */
export const extraFontFor = (value: string): BundledFont | undefined => EXTRA_FONTS.find((f) => f.family.toLowerCase() === firstFamily(value).toLowerCase());

export const extraFontFiles = (): string[] => EXTRA_FONTS.flatMap((f) => [`${FONT_DIR}${f.regular}`, `${FONT_DIR}${f.bold}`]);
export const pdfFaceName = (f: BundledFont, bold: boolean): string => `EF-${f.id}-${bold ? "Bold" : "Regular"}`;
