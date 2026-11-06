/**
 * The Design check (Phase 32.7): humanitarian-communication conventions as one table of rules,
 * run live in the Studio and again before an export is published. Pure: it reads the design, the
 * theme and a small summary of the project's records, and returns findings in plain words.
 *
 * Conventions come from coordination-community snapshot guidance: one story, specific titles,
 * sentence case, rounded headline numbers, sourced figures, a zero baseline (the chart engine
 * always starts bars at zero, so there is no rule to fail), at most five pie slices, few lines,
 * a legend and the UN map disclaimer on every map, readable contrast and consent for photos.
 *
 * Severity: BLOCKER stops a publish unless the author waives it with a reason (the waiver is
 * stored in the design and audited); WARN and TIP never stop anything. The profile only chooses
 * which rules apply and how strict they are; it never changes what is drawn.
 */
import { spanOf, type InfographicConfig, type InfographicProfile, type InfographicSectionConfig } from "./composition.js";
import { contrastRatio, type InfographicTheme } from "./theme.js";

export type DesignSeverity = "BLOCKER" | "WARN" | "TIP";

export interface DesignFinding {
  ruleId: string;
  severity: DesignSeverity;
  message: string;
  fix: string;
  /** Index into `config.sections`, when the finding is about one section. */
  sectionIndex?: number;
  /** A blocker the author has waived with a reason. */
  waived?: boolean;
}

/** What the check needs to know about the project's records and uploads (assembled by the caller). */
export interface DesignCheckContext {
  config: InfographicConfig;
  theme: InfographicTheme;
  country?: string;
  /** Plotted values not yet verified. */
  unverifiedValues: number;
  /** Ids of the project's live indicators. */
  indicatorIds: ReadonlySet<string>;
  /** Ids of uploaded assets that exist for this organization. */
  assetIds: ReadonlySet<string>;
  /** The smallest number of unique people in any one location (undefined when nothing is recorded). */
  smallestReachCell?: number;
}

interface Rule {
  id: string;
  title: string;
  /** Profiles where the rule applies; absent = all. */
  profiles?: readonly InfographicProfile[];
  /** How strict it is per profile (default `severity`). */
  severity: DesignSeverity;
  strict?: Partial<Record<InfographicProfile, DesignSeverity>>;
  run(ctx: DesignCheckContext): Array<{ message: string; fix: string; sectionIndex?: number }>;
}

const GENERIC_TITLES = new Set(["infographic", "snapshot", "humanitarian snapshot", "untitled", "project overview", "overview", "flash update", "results chain", "project factsheet", "social card"]);
const COMMON_ACRONYMS = new Set(["UN", "US", "USA", "EU", "UK", "COVID", "HIV", "AIDS", "WASH", "PDF", "PNG", "OK", "NGO", "USD", "EUR"]);

const visible = (config: InfographicConfig): Array<{ section: InfographicSectionConfig; index: number }> =>
  config.sections.map((section, index) => ({ section, index })).filter(({ section }) => !section.hidden);

const titleOf = (config: InfographicConfig): string => (config.title ?? "").trim();

const wordsOf = (value: string): string[] => value.split(/\s+/).filter(Boolean);

/** "Title Case Like This": three or more words and most of the later ones start with a capital. */
function looksTitleCase(value: string): boolean {
  const words = wordsOf(value).filter((w) => /^[A-Za-zÀ-ÿ]/.test(w));
  if (words.length < 3) return false;
  const later = words.slice(1).filter((w) => w.length > 3);
  if (later.length < 2) return false;
  const capitalised = later.filter((w) => /^[A-ZÀ-Þ]/.test(w)).length;
  return capitalised / later.length > 0.6;
}

const EMPTY_AUTHORED: Readonly<Partial<Record<InfographicSectionConfig["kind"], (s: InfographicSectionConfig) => boolean>>> = {
  KEY_MESSAGES: (s) => !s.messages?.length,
  TIMELINE: (s) => !s.events?.length,
  QUOTE: (s) => !s.text?.trim(),
  IMAGE: (s) => !s.assetId,
  SECTOR_GRID: (s) => !s.sectors?.length,
  FUNNEL: (s) => !s.stages?.length || s.stages.every((stage) => stage.value === undefined && !stage.bind),
  BIG_NUMBERS: (s) => !s.numbers?.length,
  THREE_W: (s) => !s.presence?.length,
};

export const DESIGN_RULES: readonly Rule[] = [
  {
    id: "TITLE_GENERIC",
    title: "Specific title",
    severity: "WARN",
    profiles: ["SNAPSHOT", "DONOR_REPORT", "SOCIAL"],
    run: ({ config }) => {
      const title = titleOf(config).toLowerCase();
      return !title || GENERIC_TITLES.has(title) ? [{ message: "The title is missing or generic.", fix: "Say what the page is about, for example “Gulu district: clean water reached 21,000 people”." }] : [];
    },
  },
  {
    id: "TITLE_ACRONYM",
    title: "No unexplained acronyms",
    severity: "TIP",
    profiles: ["SNAPSHOT", "DONOR_REPORT", "SOCIAL"],
    run: ({ config }) => {
      const acronyms = wordsOf(titleOf(config)).map((w) => w.replace(/[^A-Za-z]/g, "")).filter((w) => w.length >= 2 && w.length <= 6 && w === w.toUpperCase() && !COMMON_ACRONYMS.has(w));
      return acronyms.length > 0 ? [{ message: `The title uses ${acronyms.join(", ")}.`, fix: "Spell it out; most readers do not know sector or programme abbreviations." }] : [];
    },
  },
  {
    id: "SENTENCE_CASE",
    title: "Sentence case in headings",
    severity: "TIP",
    profiles: ["SNAPSHOT", "DONOR_REPORT"],
    run: ({ config }) =>
      visible(config)
        .filter(({ section }) => section.title && looksTitleCase(section.title))
        .map(({ section, index }) => ({ message: `“${section.title}” is in title case.`, fix: "Use sentence case for headings (only the first word and names start with a capital).", sectionIndex: index })),
  },
  {
    id: "ONE_STORY",
    title: "One story",
    severity: "WARN",
    profiles: ["SNAPSHOT"],
    run: ({ config }) => {
      const sections = visible(config).filter(({ section }) => !["HERO", "DIVIDER", "BANNER", "LEGEND_NOTES", "TEXT"].includes(section.kind));
      return sections.length > 7 ? [{ message: `This snapshot has ${sections.length} blocks.`, fix: "A snapshot tells one story with at most three themes. Remove what does not support the headline." }] : [];
    },
  },
  {
    id: "DASHBOARD_DATA_IN_SNAPSHOT",
    title: "Funding and sector tables belong in a dashboard",
    severity: "WARN",
    profiles: ["SNAPSHOT"],
    run: ({ config }) =>
      visible(config)
        .filter(({ section }) => ["FUNDING", "SECTOR_GRID", "TABLE", "RESULTS_CHAIN"].includes(section.kind))
        .map(({ section, index }) => ({ message: "Funding, sector and indicator tables belong in a dashboard, not a snapshot.", fix: "Remove this block, or change the design's purpose to Donor report.", sectionIndex: index })),
  },
  {
    id: "PIE_SLICES",
    title: "At most five slices",
    severity: "WARN",
    run: ({ config }) =>
      visible(config)
        .filter(({ section }) => section.kind === "CHART" && section.chart?.type === "PIE" && section.chart.indicatorIds.length > 5)
        .map(({ index }) => ({ message: "A pie chart with more than five slices is hard to read.", fix: "Combine the small ones into “Other”, or use a bar chart.", sectionIndex: index })),
  },
  {
    id: "TOO_MANY_LINES",
    title: "At most four lines in one chart",
    severity: "WARN",
    run: ({ config }) =>
      visible(config)
        .filter(({ section }) => section.kind === "CHART" && (section.chart?.type === "LINE" || section.chart?.type === "AREA") && section.chart.indicatorIds.length > 4)
        .map(({ index }) => ({ message: "More than four lines in one chart cross each other.", fix: "Show each indicator in its own small chart (use the Trends block).", sectionIndex: index })),
  },
  {
    id: "MAP_DISCLAIMER",
    title: "Map disclaimer",
    severity: "BLOCKER",
    strict: { INTERNAL: "WARN", SOCIAL: "WARN" },
    run: ({ config }) =>
      config.mapDisclaimer === false
        ? visible(config).filter(({ section }) => section.kind === "MAP").map(({ index }) => ({ message: "This map has no disclaimer.", fix: "Turn the map disclaimer back on; a map without it can imply endorsement of borders.", sectionIndex: index }))
        : [],
  },
  {
    id: "SOURCE_MISSING",
    title: "Every figure has a source",
    severity: "WARN",
    strict: { DONOR_REPORT: "BLOCKER", SNAPSHOT: "BLOCKER" },
    run: ({ config }) => {
      const out: Array<{ message: string; fix: string; sectionIndex?: number }> = [];
      for (const { section, index } of visible(config)) {
        for (const item of section.numbers ?? []) {
          if (item.source === "MANUAL" && item.value && !item.sourceNote) out.push({ message: `“${item.label}” is a typed figure with no source.`, fix: "Say where it comes from (for example “Needs assessment, March 2026”).", sectionIndex: index });
        }
        if (section.kind === "THREE_W" && section.presence?.length && !section.caption?.trim()) out.push({ message: "The who-does-what-where matrix has no source.", fix: "Say where the information comes from (for example “Partner reports, September 2026”) in the source line.", sectionIndex: index });
        for (const stage of section.stages ?? []) {
          if (stage.value !== undefined && !stage.bind && !stage.sourceNote) out.push({ message: `“${stage.label}” is a typed figure with no source.`, fix: "Say where it comes from.", sectionIndex: index });
        }
      }
      return out;
    },
  },
  {
    id: "UNVERIFIED_VALUES",
    title: "Verified figures",
    severity: "WARN",
    run: ({ unverifiedValues }) => (unverifiedValues > 0 ? [{ message: `${unverifiedValues} plotted value${unverifiedValues === 1 ? " is" : "s are"} not verified yet.`, fix: "Verify them first, or accept that the footer will say so." }] : []),
  },
  {
    id: "CONTRAST",
    title: "Readable colours",
    severity: "WARN",
    profiles: ["SNAPSHOT", "DONOR_REPORT", "SOCIAL"],
    run: ({ theme }) => {
      const weak = (["ink", "body", "muted", "subtle", "accent", "warn"] as const).filter((token) => contrastRatio(theme[token], theme.card) < 4.5);
      return weak.length > 0 ? [{ message: `The “${theme.label}” theme has low-contrast text colours.`, fix: "Choose a theme that passes the contrast check, such as Humanitarian blue or High contrast." }] : [];
    },
  },
  {
    id: "PHOTO_CONSENT",
    title: "Consent for people in photos",
    severity: "BLOCKER",
    strict: { INTERNAL: "WARN" },
    run: ({ config }) =>
      visible(config)
        .filter(({ section }) => (section.kind === "IMAGE" || section.kind === "QUOTE" || section.kind === "HERO") && section.assetId && !section.consentConfirmed)
        .map(({ index }) => ({ message: "A photo is used without confirming consent.", fix: "Confirm that the people shown agreed to appear, or choose another image.", sectionIndex: index })),
  },
  {
    id: "ALT_TEXT",
    title: "Describe images",
    severity: "TIP",
    strict: { DONOR_REPORT: "WARN", SOCIAL: "WARN" },
    run: ({ config }) =>
      visible(config)
        .filter(({ section }) => (section.kind === "IMAGE" || section.kind === "HERO") && section.assetId && !section.altText)
        .map(({ index }) => ({ message: "This image has no description for readers who cannot see it.", fix: "Write one sentence saying what the image shows.", sectionIndex: index })),
  },
  {
    id: "ASSET_MISSING",
    title: "Images exist",
    severity: "BLOCKER",
    run: ({ config, assetIds }) => {
      const out: Array<{ message: string; fix: string; sectionIndex?: number }> = [];
      for (const { section, index } of visible(config)) if (section.assetId && !assetIds.has(section.assetId)) out.push({ message: "An image used here has been removed.", fix: "Choose another image or remove the block.", sectionIndex: index });
      for (const id of config.donorLogoAssetIds ?? []) if (!assetIds.has(id)) out.push({ message: "A partner logo has been removed.", fix: "Upload it again or remove it from the header." });
      if (config.coverAssetId && !assetIds.has(config.coverAssetId)) out.push({ message: "The cover image has been removed.", fix: "Choose another cover image." });
      return out;
    },
  },
  {
    id: "EMPTY_BLOCK",
    title: "Nothing empty",
    severity: "WARN",
    run: ({ config }) =>
      visible(config)
        .filter(({ section }) => EMPTY_AUTHORED[section.kind]?.(section))
        .map(({ section, index }) => ({ message: `The ${section.title ?? section.kind.toLowerCase().replace(/_/g, " ")} block has nothing in it, so it is left out of the export.`, fix: "Fill it in, or hide or remove it.", sectionIndex: index })),
  },
  {
    id: "SMALL_NUMBERS",
    title: "Small numbers can identify people",
    severity: "WARN",
    run: ({ config, smallestReachCell }) => {
      if (smallestReachCell === undefined || smallestReachCell <= 0 || smallestReachCell >= 5) return [];
      const shows = visible(config).some(({ section }) => ["REACH", "DEMOGRAPHICS", "MAP"].includes(section.kind));
      return shows ? [{ message: `At least one location has fewer than 5 people recorded (${smallestReachCell}).`, fix: "Combine small places or leave the breakdown out, so no one can be recognised." }] : [];
    },
  },
  {
    id: "FUNNEL_ORDER",
    title: "Need, target and reach in order",
    severity: "WARN",
    run: ({ config }) =>
      visible(config)
        .filter(({ section }) => {
          if (section.kind !== "FUNNEL") return false;
          const values = (section.stages ?? []).map((s) => s.value).filter((v): v is number => v !== undefined);
          return values.some((value, i) => i > 0 && value > (values[i - 1] ?? Infinity));
        })
        .map(({ index }) => ({ message: "A later stage is larger than the one before it.", fix: "Check the figures: people targeted cannot exceed people in need.", sectionIndex: index })),
  },
  {
    id: "ROUND_NUMBERS",
    title: "Round headline numbers",
    severity: "TIP",
    profiles: ["SNAPSHOT", "SOCIAL"],
    run: ({ config }) =>
      visible(config)
        .filter(({ section }) => section.kind === "BIG_NUMBERS" && !section.rounding)
        .map(({ index }) => ({ message: "Headline numbers are not rounded.", fix: "Round to hundreds or thousands; the figures keep changing.", sectionIndex: index })),
  },
  {
    id: "INDICATOR_GONE",
    title: "Indicators exist",
    severity: "WARN",
    run: ({ config, indicatorIds }) => {
      const out: Array<{ message: string; fix: string; sectionIndex?: number }> = [];
      for (const { section, index } of visible(config)) {
        const named = [...(section.indicatorIds ?? []), ...(section.chart?.indicatorIds ?? []), ...(section.numbers ?? []).flatMap((n) => (n.indicatorId ? [n.indicatorId] : [])), ...(section.sectors ?? []).flatMap((c) => c.indicatorIds)];
        if (named.some((id) => !indicatorIds.has(id))) out.push({ message: "This block names an indicator that is no longer in the project.", fix: "Pick the indicator again.", sectionIndex: index });
      }
      return out;
    },
  },
  {
    id: "ACKNOWLEDGEMENT",
    title: "Thank the funder",
    severity: "TIP",
    profiles: ["DONOR_REPORT"],
    run: ({ config }) => (!config.acknowledgement && !(config.donorLogoAssetIds?.length) ? [{ message: "No funder acknowledgement.", fix: "Add a line such as “With funding from …” or upload the funder's logo." }] : []),
  },
  {
    id: "SOCIAL_LENGTH",
    title: "Short text for social cards",
    severity: "TIP",
    profiles: ["SOCIAL"],
    run: ({ config }) =>
      visible(config)
        .filter(({ section }) => (section.text?.length ?? 0) > 140 || (section.messages ?? []).some((m) => m.text.length > 100))
        .map(({ index }) => ({ message: "This text is long for a social card.", fix: "Say it in one short sentence.", sectionIndex: index })),
  },
  {
    id: "SECTION_COUNT_FIT",
    title: "Fits the page",
    severity: "TIP",
    profiles: ["SOCIAL"],
    run: ({ config }) => {
      const columns = visible(config).reduce((sum, { section }) => sum + spanOf(section), 0);
      return columns > 36 ? [{ message: "A single social card with this many blocks will be cramped.", fix: "Keep one number, one sentence and one image." }] : [];
    },
  },
];

const RULE_BY_ID = new Map(DESIGN_RULES.map((rule) => [rule.id, rule]));
export const designRuleTitle = (ruleId: string): string => RULE_BY_ID.get(ruleId)?.title ?? ruleId;

export interface DesignCheckResult {
  findings: DesignFinding[];
  /** Blockers that have not been waived. */
  blockers: DesignFinding[];
  canPublish: boolean;
}

const SEVERITY_ORDER: Readonly<Record<DesignSeverity, number>> = { BLOCKER: 0, WARN: 1, TIP: 2 };

export function checkDesign(ctx: DesignCheckContext): DesignCheckResult {
  const profile: InfographicProfile = ctx.config.profile ?? "INTERNAL";
  const waived = new Set((ctx.config.waivers ?? []).map((w) => w.ruleId));
  const findings: DesignFinding[] = [];
  for (const rule of DESIGN_RULES) {
    if (rule.profiles && !rule.profiles.includes(profile)) continue;
    const severity = rule.strict?.[profile] ?? rule.severity;
    for (const hit of rule.run(ctx)) {
      findings.push({ ruleId: rule.id, severity, message: hit.message, fix: hit.fix, ...(hit.sectionIndex !== undefined ? { sectionIndex: hit.sectionIndex } : {}), ...(severity === "BLOCKER" && waived.has(rule.id) ? { waived: true } : {}) });
    }
  }
  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || (a.sectionIndex ?? -1) - (b.sectionIndex ?? -1));
  const blockers = findings.filter((f) => f.severity === "BLOCKER" && !f.waived);
  return { findings, blockers, canPublish: blockers.length === 0 };
}
