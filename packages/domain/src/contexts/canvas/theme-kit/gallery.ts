/**
 * The theme gallery (Phase 48.13): 60 curated looks, each in four tones (light, dark, print, high contrast) built from one spec, so
 * every one meets the contrast rules. A theme id is the spec id (light) or `<id>:dark`, `<id>:print`, `<id>:high_contrast`. The first
 * five legacy infographic themes stay as they were; these are the new ones. A spec is a row: add a look by adding a line.
 */
import { setThemeLoader, type InfographicTheme } from "../../infographics/theme.js";
import { buildTheme, THEME_TONES, withTone, type Neutral, type ThemeSpec, type ThemeTone } from "./build-theme.js";

export const THEME_FAMILIES = ["HUMANITARIAN", "DONOR", "SECTOR", "BOLD", "SOFT", "EARTH", "EDITORIAL", "PRINT"] as const;
export type ThemeFamily = (typeof THEME_FAMILIES)[number];

interface Row { id: string; label: string; accent: string; neutral: Neutral; font: string; family: ThemeFamily; description: string; accent2?: string; heading?: "UPPER" | "SENTENCE"; radius?: number }

const r = (id: string, label: string, accent: string, neutral: Neutral, font: string, family: ThemeFamily, description: string, extra: Partial<Row> = {}): Row => ({ id, label, accent, neutral, font, family, description, ...extra });

const ROWS: readonly Row[] = [
  r("OCHA_BLUE", "Coordination blue", "#418fde", "COOL", "liberation-sans", "HUMANITARIAN", "A clear blue on white, in the manner of coordination snapshots."),
  r("RELIEF_RED", "Relief red", "#c8302c", "NEUTRAL", "liberation-sans", "HUMANITARIAN", "A strong red for emergency updates."),
  r("FIELD_GREEN", "Field green", "#2e7d4f", "WARM", "source-sans-3", "HUMANITARIAN", "Calm green for programme and field reports."),
  r("SAHEL_SAND", "Sahel sand", "#b7791f", "WARM", "source-sans-3", "HUMANITARIAN", "Warm ochre for food security and drylands."),
  r("DELTA_TEAL", "Delta teal", "#0f766e", "COOL", "inter", "HUMANITARIAN", "Teal for water and health."),
  r("UNITY_NAVY", "Unity navy", "#1e3a8a", "COOL", "open-sans", "DONOR", "A serious navy for donor reports."),
  r("GRANT_SLATE", "Grant slate", "#334155", "COOL", "source-sans-3", "DONOR", "Restrained slate for formal submissions."),
  r("TREASURY_GREEN", "Treasury green", "#166534", "NEUTRAL", "source-serif-4", "DONOR", "Deep green with a serif heading, for finance pages."),
  r("MERIT_BURGUNDY", "Merit burgundy", "#7f1d1d", "WARM", "merriweather", "DONOR", "Burgundy for annual reports."),
  r("PARTNER_PLUM", "Partner plum", "#6b21a8", "COOL", "lato", "DONOR", "Plum for partnership summaries."),
  r("WASH_AQUA", "Water aqua", "#0284c7", "COOL", "inter", "SECTOR", "For water, sanitation and hygiene."),
  r("HEALTH_CROSS", "Health cross", "#be123c", "NEUTRAL", "open-sans", "SECTOR", "For health and nutrition clinics."),
  r("NUTRITION_ORANGE", "Nutrition orange", "#c2410c", "WARM", "nunito-sans", "SECTOR", "Warm orange for nutrition programmes."),
  r("EDUCATION_INK", "Education ink", "#1d4ed8", "COOL", "public-sans", "SECTOR", "Ink blue for schools and learning."),
  r("PROTECTION_VIOLET", "Protection violet", "#7c3aed", "COOL", "inter", "SECTOR", "For protection and child safeguarding."),
  r("SHELTER_BRICK", "Shelter brick", "#9a3412", "WARM", "work-sans", "SECTOR", "Brick red for shelter and settlements."),
  r("LIVELIHOODS_LIME", "Livelihoods lime", "#4d7c0f", "WARM", "source-sans-3", "SECTOR", "Fresh green for livelihoods and agriculture."),
  r("CLIMATE_FOREST", "Climate forest", "#14532d", "NEUTRAL", "ibm-plex-sans", "SECTOR", "Forest green for climate and environment."),
  r("GENDER_ROSE", "Gender rose", "#be185d", "COOL", "poppins", "SECTOR", "Rose for gender equality work."),
  r("MHPSS_LAVENDER", "Wellbeing lavender", "#6d28d9", "COOL", "nunito-sans", "SECTOR", "Gentle lavender for mental health and psychosocial support.", { radius: 14 }),
  r("LOGISTICS_STEEL", "Logistics steel", "#475569", "COOL", "roboto", "SECTOR", "Steel grey for logistics and supply."),
  r("CASH_GOLD", "Cash gold", "#a16207", "WARM", "lato", "SECTOR", "Gold for cash and markets."),
  r("ENERGY_AMBER", "Energy amber", "#b45309", "WARM", "archivo", "SECTOR", "Amber for energy and infrastructure."),
  r("INCLUSION_CYAN", "Inclusion cyan", "#0e7490", "COOL", "inter", "SECTOR", "Cyan for disability inclusion."),
  r("GOVERNANCE_INDIGO", "Governance indigo", "#4338ca", "COOL", "source-sans-3", "SECTOR", "Indigo for governance and accountability."),
  r("BOLD_SIGNAL", "Bold signal", "#e11d48", "NEUTRAL", "montserrat", "BOLD", "High-energy red-pink for campaigns.", { heading: "UPPER" }),
  r("BOLD_VOLT", "Bold volt", "#65a30d", "NEUTRAL", "montserrat", "BOLD", "A sharp green for social cards.", { heading: "UPPER" }),
  r("BOLD_ULTRAMARINE", "Bold ultramarine", "#2563eb", "NEUTRAL", "poppins", "BOLD", "Strong blue with large headings.", { heading: "UPPER" }),
  r("BOLD_TANGERINE", "Bold tangerine", "#ea580c", "NEUTRAL", "oswald", "BOLD", "Orange condensed headings for posters.", { heading: "UPPER" }),
  r("BOLD_MAGENTA", "Bold magenta", "#c026d3", "NEUTRAL", "montserrat", "BOLD", "Magenta for youth and events.", { heading: "UPPER" }),
  r("BOLD_TURQUOISE", "Bold turquoise", "#0d9488", "NEUTRAL", "raleway", "BOLD", "Turquoise for coastal and water stories.", { heading: "UPPER" }),
  r("SOFT_SKY", "Soft sky", "#3b82f6", "COOL", "nunito-sans", "SOFT", "Light blue, rounded and friendly.", { radius: 16 }),
  r("SOFT_MINT", "Soft mint", "#10b981", "COOL", "nunito-sans", "SOFT", "Mint green for community stories.", { radius: 16 }),
  r("SOFT_PEACH", "Soft peach", "#f97316", "WARM", "nunito-sans", "SOFT", "Peach for family and child topics.", { radius: 16 }),
  r("SOFT_LILAC", "Soft lilac", "#8b5cf6", "COOL", "nunito-sans", "SOFT", "Lilac for wellbeing.", { radius: 16 }),
  r("SOFT_ROSE", "Soft rose", "#ec4899", "WARM", "nunito-sans", "SOFT", "Rose for gender and health.", { radius: 16 }),
  r("SOFT_SAGE", "Soft sage", "#4d7c5a", "WARM", "nunito-sans", "SOFT", "Sage for environment.", { radius: 16 }),
  r("EARTH_CLAY", "Earth clay", "#a8553a", "WARM", "source-sans-3", "EARTH", "Clay and sand tones."),
  r("EARTH_OLIVE", "Earth olive", "#5a6b2a", "WARM", "source-sans-3", "EARTH", "Olive for agriculture."),
  r("EARTH_OCHRE", "Earth ochre", "#b9770e", "WARM", "lato", "EARTH", "Ochre for savannah landscapes."),
  r("EARTH_UMBER", "Earth umber", "#6b4423", "WARM", "merriweather", "EARTH", "Umber with a serif heading."),
  r("EARTH_TERRACOTTA", "Earth terracotta", "#c2603a", "WARM", "work-sans", "EARTH", "Terracotta for shelter."),
  r("EARTH_MOSS", "Earth moss", "#3f6212", "WARM", "source-sans-3", "EARTH", "Moss green for forestry."),
  r("EDITORIAL_INK", "Editorial ink", "#111827", "NEUTRAL", "playfair-display", "EDITORIAL", "Black ink and a display serif.", { heading: "SENTENCE" }),
  r("EDITORIAL_RED", "Editorial red", "#b91c1c", "NEUTRAL", "playfair-display", "EDITORIAL", "A newspaper red.", { heading: "SENTENCE" }),
  r("EDITORIAL_BLUE", "Editorial blue", "#1e40af", "NEUTRAL", "libre-baskerville", "EDITORIAL", "Blue and a text serif.", { heading: "SENTENCE" }),
  r("EDITORIAL_GREEN", "Editorial green", "#166534", "NEUTRAL", "lora", "EDITORIAL", "Green and a warm serif.", { heading: "SENTENCE" }),
  r("EDITORIAL_PLUM", "Editorial plum", "#701a75", "NEUTRAL", "crimson-pro", "EDITORIAL", "Plum with a classic serif.", { heading: "SENTENCE" }),
  r("EDITORIAL_SLATE", "Editorial slate", "#334155", "NEUTRAL", "pt-serif", "EDITORIAL", "Slate and a book serif.", { heading: "SENTENCE" }),
  r("PRINT_BLUE", "Print blue", "#1d4ed8", "NEUTRAL", "liberation-sans", "PRINT", "Plain, ink-saving blue for printing.", { radius: 2 }),
  r("PRINT_GREEN", "Print green", "#15803d", "NEUTRAL", "liberation-sans", "PRINT", "Plain green for printing.", { radius: 2 }),
  r("PRINT_RED", "Print red", "#b91c1c", "NEUTRAL", "liberation-sans", "PRINT", "Plain red for printing.", { radius: 2 }),
  r("PRINT_GREY", "Print grey", "#374151", "NEUTRAL", "liberation-sans", "PRINT", "Greyscale-safe for photocopies.", { radius: 2 }),
  r("PRINT_TEAL", "Print teal", "#0f766e", "NEUTRAL", "liberation-sans", "PRINT", "Plain teal for printing.", { radius: 2 }),
  r("PRINT_PURPLE", "Print purple", "#6d28d9", "NEUTRAL", "liberation-sans", "PRINT", "Plain purple for printing.", { radius: 2 }),
  r("ARABIC_NAVY", "Arabic navy", "#1e3a8a", "COOL", "noto-sans-arabic", "HUMANITARIAN", "Navy with an Arabic-ready face."),
  r("ARABIC_GREEN", "Arabic green", "#166534", "WARM", "noto-sans-arabic", "HUMANITARIAN", "Green with an Arabic-ready face."),
  r("ARABIC_TEAL", "Arabic teal", "#0f766e", "COOL", "noto-sans-arabic", "HUMANITARIAN", "Teal with an Arabic-ready face."),
  r("ARABIC_BURGUNDY", "Arabic burgundy", "#7f1d1d", "WARM", "noto-sans-arabic", "DONOR", "Burgundy with an Arabic-ready face."),
  r("ARABIC_SAND", "Arabic sand", "#a16207", "WARM", "noto-sans-arabic", "EARTH", "Sand with an Arabic-ready face."),
  r("CLEAN_MONO", "Clean mono", "#0f172a", "NEUTRAL", "ibm-plex-sans", "EDITORIAL", "Near-black on white: the quietest look."),
  r("CLEAN_BLUE_GREY", "Clean blue-grey", "#475569", "COOL", "inter", "DONOR", "Blue-grey for dense dashboards."),
  r("DENSE_DASH", "Dense dashboard", "#2563eb", "COOL", "inter", "DONOR", "Tight spacing and a neutral blue for data-heavy pages.", { radius: 6 }),
];

const toSpec = (x: Row): ThemeSpec => ({ id: x.id, label: x.label, description: x.description, accent: x.accent, accent2: x.accent2, neutral: x.neutral, font: x.font, headingCase: x.heading, radius: x.radius });

export const THEME_SPECS: readonly (ThemeSpec & { family: ThemeFamily })[] = ROWS.map((x) => ({ ...toSpec(x), family: x.family }));

const SPEC_BY_ID = new Map(THEME_SPECS.map((s) => [s.id, s]));
const BUILT = new Map<string, InfographicTheme>();

/** One gallery theme, built the first time it is asked for (60 themes x 4 tones cost seconds of colour maths, and a page uses one). `id:tone` names a non-light tone. */
function buildGalleryTheme(id: string): InfographicTheme | undefined {
  const cached = BUILT.get(id);
  if (cached) return cached;
  const [base, tone] = id.split(":");
  const spec = base ? SPEC_BY_ID.get(base) : undefined;
  if (!spec) return undefined;
  const wanted = THEME_TONES.find((t) => (tone ? t.toLowerCase() === tone : t === "LIGHT"));
  if (!wanted) return undefined;
  const theme = wanted === "LIGHT" ? buildTheme(spec) : withTone(spec, wanted);
  BUILT.set(id, theme);
  return theme;
}
setThemeLoader(buildGalleryTheme);

/** Every theme in the gallery in every tone, built on first call (use `galleryTheme` for one). */
export const galleryThemes = (): readonly InfographicTheme[] => THEME_SPECS.flatMap((s) => THEME_TONES.map((tone) => buildGalleryTheme(tone === "LIGHT" ? s.id : `${s.id}:${tone.toLowerCase()}`) as InfographicTheme));

export const GALLERY_IDS: readonly string[] = THEME_SPECS.map((s) => s.id);
export const galleryTheme = (id: string, tone: ThemeTone = "LIGHT"): InfographicTheme | undefined => buildGalleryTheme(tone === "LIGHT" ? id : `${id}:${tone.toLowerCase()}`);
export const themesInFamily = (family: ThemeFamily): ThemeSpec[] => THEME_SPECS.filter((s) => s.family === family);
