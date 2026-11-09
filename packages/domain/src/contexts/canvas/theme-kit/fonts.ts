/**
 * The font library (Phase 48.13). One table: a name, the CSS stack, which scripts the family covers, its licence and whether the file
 * is bundled with the product. A file can only be drawn by the export machine when it is bundled (system fonts are never loaded), so
 * `bundled` is the truth about what a download will look like; the editor shows every font and warns about one that is not bundled yet.
 * Adding a font is a row here, the font file in `packages/infrastructure/assets/fonts` and a line in its manifest.
 */
export const SCRIPTS = ["LATIN", "ARABIC", "DEVANAGARI", "ETHIOPIC", "BENGALI", "CYRILLIC", "GREEK"] as const;
export type Script = (typeof SCRIPTS)[number];
export const FONT_CATEGORIES = ["SANS", "SERIF", "DISPLAY", "MONO", "HANDWRITING"] as const;
export type FontCategory = (typeof FONT_CATEGORIES)[number];

export interface FontDef { id: string; label: string; stack: string; category: FontCategory; scripts: readonly Script[]; licence: "OFL-1.1" | "Apache-2.0" | "Bitstream-Vera-derived"; bundled: boolean }

const f = (id: string, label: string, family: string, category: FontCategory, scripts: readonly Script[], licence: FontDef["licence"] = "OFL-1.1", bundled = false): FontDef => ({
  id, label, category, scripts, licence, bundled,
  stack: `"${family}", ${category === "SERIF" ? "Georgia, serif" : category === "MONO" ? "ui-monospace, monospace" : "system-ui, sans-serif"}`,
});

const L: readonly Script[] = ["LATIN"], LC: readonly Script[] = ["LATIN", "CYRILLIC"], LCG: readonly Script[] = ["LATIN", "CYRILLIC", "GREEK"];

export const FONTS: readonly FontDef[] = [
  { id: "liberation-sans", label: "Liberation Sans", stack: '"Liberation Sans", Arial, sans-serif', category: "SANS", scripts: LCG, licence: "OFL-1.1", bundled: true },
  { id: "noto-sans-arabic", label: "Noto Sans Arabic", stack: '"Noto Sans Arabic", "Liberation Sans", sans-serif', category: "SANS", scripts: ["ARABIC", "LATIN"], licence: "OFL-1.1", bundled: true },
  f("inter", "Inter", "Inter", "SANS", LCG), f("source-sans-3", "Source Sans 3", "Source Sans 3", "SANS", LCG), f("open-sans", "Open Sans", "Open Sans", "SANS", LCG),
  f("roboto", "Roboto", "Roboto", "SANS", LCG, "Apache-2.0"), f("lato", "Lato", "Lato", "SANS", L), f("noto-sans", "Noto Sans", "Noto Sans", "SANS", LCG),
  f("ibm-plex-sans", "IBM Plex Sans", "IBM Plex Sans", "SANS", LCG), f("work-sans", "Work Sans", "Work Sans", "SANS", L), f("nunito-sans", "Nunito Sans", "Nunito Sans", "SANS", LC),
  f("public-sans", "Public Sans", "Public Sans", "SANS", L), f("fira-sans", "Fira Sans", "Fira Sans", "SANS", LCG), f("pt-sans", "PT Sans", "PT Sans", "SANS", LC),
  f("merriweather", "Merriweather", "Merriweather", "SERIF", LC), f("source-serif-4", "Source Serif 4", "Source Serif 4", "SERIF", LCG), f("noto-serif", "Noto Serif", "Noto Serif", "SERIF", LCG),
  f("lora", "Lora", "Lora", "SERIF", LC), f("pt-serif", "PT Serif", "PT Serif", "SERIF", LC), f("playfair-display", "Playfair Display", "Playfair Display", "DISPLAY", LC),
  f("libre-baskerville", "Libre Baskerville", "Libre Baskerville", "SERIF", L), f("crimson-pro", "Crimson Pro", "Crimson Pro", "SERIF", L), f("ibm-plex-serif", "IBM Plex Serif", "IBM Plex Serif", "SERIF", LC),
  f("montserrat", "Montserrat", "Montserrat", "DISPLAY", LC), f("poppins", "Poppins", "Poppins", "DISPLAY", L), f("raleway", "Raleway", "Raleway", "DISPLAY", LC),
  f("oswald", "Oswald", "Oswald", "DISPLAY", LC), f("bebas-neue", "Bebas Neue", "Bebas Neue", "DISPLAY", L), f("archivo", "Archivo", "Archivo", "SANS", L),
  f("dm-sans", "DM Sans", "DM Sans", "SANS", L), f("manrope", "Manrope", "Manrope", "SANS", LC), f("rubik", "Rubik", "Rubik", "SANS", LC),
  f("jetbrains-mono", "JetBrains Mono", "JetBrains Mono", "MONO", LC), f("ibm-plex-mono", "IBM Plex Mono", "IBM Plex Mono", "MONO", LC), f("source-code-pro", "Source Code Pro", "Source Code Pro", "MONO", LC),
  f("caveat", "Caveat", "Caveat", "HANDWRITING", LC), f("patrick-hand", "Patrick Hand", "Patrick Hand", "HANDWRITING", L),
  f("noto-naskh-arabic", "Noto Naskh Arabic", "Noto Naskh Arabic", "SERIF", ["ARABIC", "LATIN"]), f("cairo", "Cairo", "Cairo", "SANS", ["ARABIC", "LATIN"]), f("tajawal", "Tajawal", "Tajawal", "SANS", ["ARABIC", "LATIN"]),
  f("noto-sans-devanagari", "Noto Sans Devanagari", "Noto Sans Devanagari", "SANS", ["DEVANAGARI", "LATIN"]), f("noto-sans-ethiopic", "Noto Sans Ethiopic", "Noto Sans Ethiopic", "SANS", ["ETHIOPIC", "LATIN"]),
  f("noto-sans-bengali", "Noto Sans Bengali", "Noto Sans Bengali", "SANS", ["BENGALI", "LATIN"]),
];

const BY_ID = new Map(FONTS.map((x) => [x.id, x]));
export const fontById = (id: string | undefined): FontDef | undefined => (id ? BY_ID.get(id) : undefined);
export const BUNDLED_FONTS: readonly FontDef[] = FONTS.filter((x) => x.bundled);
/** The stack for a font id; an unknown id gets the bundled default, never an empty string. */
export const stackFor = (id: string | undefined): string => (fontById(id) ?? BY_ID.get("liberation-sans")!).stack;

/** Fonts that can draw every script of a language, for the editor's pairing suggestions. */
export const fontsFor = (script: Script): FontDef[] => FONTS.filter((x) => x.scripts.includes(script));

/** Pairings that go together: a heading face and a body face (the pairing presets of the theme builder). */
export const FONT_PAIRS: ReadonlyArray<{ id: string; heading: string; body: string }> = [
  { id: "classic", heading: "merriweather", body: "source-sans-3" }, { id: "modern", heading: "montserrat", body: "open-sans" }, { id: "editorial", heading: "playfair-display", body: "lato" },
  { id: "clean", heading: "inter", body: "inter" }, { id: "report", heading: "source-serif-4", body: "source-sans-3" }, { id: "bold", heading: "oswald", body: "roboto" },
  { id: "friendly", heading: "poppins", body: "nunito-sans" }, { id: "technical", heading: "ibm-plex-sans", body: "ibm-plex-mono" }, { id: "default", heading: "liberation-sans", body: "liberation-sans" },
  { id: "arabic", heading: "noto-sans-arabic", body: "noto-sans-arabic" },
];
