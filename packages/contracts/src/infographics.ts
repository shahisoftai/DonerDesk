import { z } from "zod";

/**
 * Infographic Studio (Phase 31): the wire shapes for saved designs and their exports. The
 * composition is validated again in the domain (`validateConfig`) — this schema only fixes the
 * wire contract and the obvious sizes, so a bad design is refused with one clear sentence.
 */

export const INFOGRAPHIC_TEMPLATE_IDS = [
  "OVERVIEW", "PROGRESS", "RESULTS", "BUDGET", "THEMATIC", "CLOSURE",
  "SNAPSHOT", "AT_A_GLANCE", "SECTOR_RESULTS", "FUNDING_SNAPSHOT", "COVERAGE_BY_LOCATION", "BENEFICIARY_PROFILE",
  "FLASH_UPDATE", "DONOR_ONE_PAGER", "ANNUAL_POSTER", "FACTSHEET", "STORY_CARD", "SOCIAL_STORY",
  "SLIDE_SUMMARY", "RESULTS_CHAIN_PAGE", "SECTOR_DASHBOARD", "CUSTOM",
  "PORTFOLIO_OVERVIEW", "OPERATIONAL_PRESENCE",
] as const;

export const INFOGRAPHIC_SECTION_KINDS = [
  "KPIS", "CHART", "LOCATION_RESULTS", "LOCATION_COMPARISON", "REACH", "ACTIVITIES_BY_LOCATION", "MAP", "TEXT",
  "HERO", "BIG_NUMBERS", "FUNNEL", "PROGRESS_RINGS", "DEMOGRAPHICS", "SECTOR_GRID", "TIMELINE", "KEY_MESSAGES", "QUOTE", "IMAGE",
  "LEGEND_NOTES", "BANNER", "FUNDING", "SMALL_MULTIPLES", "TABLE", "RESULTS_CHAIN", "DIVIDER",
  "PORTFOLIO_SUMMARY", "PORTFOLIO_TABLE", "PORTFOLIO_HEALTH", "PORTFOLIO_COUNTRIES", "THREE_W",
] as const;

export const InfographicSectionKindSchema = z.enum(INFOGRAPHIC_SECTION_KINDS);

export const InfographicChartSpecSchema = z
  .object({
    template: z.string().min(1).max(60),
    indicatorIds: z.array(z.string().min(1).max(64)).max(30),
    measure: z.enum(["PERIOD", "CUMULATIVE", "PERCENT_OF_TARGET"]),
    type: z.enum(["BAR", "LINE", "PIE", "AREA", "RADAR", "GAUGE"]),
    showTarget: z.boolean().optional(),
    title: z.string().max(120).optional(),
  })
  .strict();

const iconId = z.string().min(1).max(30);

export const InfographicSectionSchema = z
  .object({
    kind: InfographicSectionKindSchema,
    title: z.string().max(120).optional(),
    text: z.string().max(600).optional(),
    chart: InfographicChartSpecSchema.optional(),
    indicatorIds: z.array(z.string().min(1).max(64)).max(30).optional(),
    locationKeys: z.array(z.string().min(1).max(120)).max(100).optional(),
    size: z.enum(["THIRD", "HALF", "FULL"]).optional(),
    span: z.number().int().min(3).max(12).optional(),
    hidden: z.boolean().optional(),
    pageBreakBefore: z.boolean().optional(),
    iconId: iconId.optional(),
    numbers: z
      .array(
        z
          .object({
            label: z.string().max(60),
            source: z.enum(["MANUAL", "INDICATOR", "REACH_UNIQUE", "REACH_REGISTERED", "ACTIVITIES_DONE", "ACTIVITIES_PLANNED", "FINANCE_BUDGET", "FINANCE_EXPENDITURE", "FINANCE_BALANCE", "PORTFOLIO_PROJECTS", "PORTFOLIO_COUNTRIES", "PORTFOLIO_OFF_TRACK", "PORTFOLIO_AT_RISK", "PORTFOLIO_OPEN_RISKS", "PORTFOLIO_REPORTS_OVERDUE"]),
            value: z.string().max(24).optional(),
            indicatorId: z.string().min(1).max(64).optional(),
            unit: z.string().max(16).optional(),
            iconId: iconId.optional(),
            caption: z.string().max(80).optional(),
            sourceNote: z.string().max(80).optional(),
          })
          .strict(),
      )
      .max(6)
      .optional(),
    stages: z
      .array(
        z
          .object({
            label: z.string().max(40),
            value: z.number().min(0).max(1e10).optional(),
            bind: z.enum(["REACH_UNIQUE", "REACH_REGISTERED"]).optional(),
            sourceNote: z.string().max(80).optional(),
          })
          .strict(),
      )
      .max(5)
      .optional(),
    messages: z.array(z.object({ text: z.string().max(160), iconId: iconId.optional() }).strict()).max(5).optional(),
    events: z
      .array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), label: z.string().max(80), detail: z.string().max(160).optional() }).strict())
      .max(12)
      .optional(),
    sectors: z.array(z.object({ label: z.string().max(40), iconId: iconId.optional(), indicatorIds: z.array(z.string().min(1).max(64)).max(4) }).strict()).max(8).optional(),
    attribution: z.string().max(80).optional(),
    assetId: z.string().min(1).max(64).optional(),
    caption: z.string().max(160).optional(),
    credit: z.string().max(80).optional(),
    altText: z.string().max(200).optional(),
    consentConfirmed: z.boolean().optional(),
    fit: z.enum(["COVER", "CONTAIN"]).optional(),
    notes: z.array(z.string().max(200)).max(8).optional(),
    rounding: z.enum(["NONE", "HUNDREDS", "THOUSANDS"]).optional(),
    mapMetric: z.enum(["NONE", "REACH", "ACTIVITIES_DONE", "ACTIVITIES_PLANNED"]).optional(),
    presence: z.array(z.object({ who: z.string().max(60), what: z.string().max(60), where: z.array(z.string().max(60)).max(8) }).strict()).max(16).optional(),
  })
  .strict();

export const InfographicConfigSchema = z
  .object({
    templateId: z.enum(INFOGRAPHIC_TEMPLATE_IDS),
    templateVersion: z.number().int().min(1),
    title: z.string().max(120).optional(),
    periodFromId: z.string().min(1).max(64).optional(),
    periodToId: z.string().min(1).max(64).optional(),
    locationKeys: z.array(z.string().min(1).max(120)).max(100).optional(),
    branding: z.boolean().optional(),
    scope: z.enum(["PROJECT", "PORTFOLIO"]).optional(),
    autoRefresh: z.boolean().optional(),
    themeId: z.enum(["DEFAULT", "HUMANITARIAN_BLUE", "CYAN", "HIGH_CONTRAST", "PRINT_MONO", "BRAND"]).optional(),
    format: z.enum(["A4_PORTRAIT", "A4_LANDSCAPE", "A3_PORTRAIT", "A3_LANDSCAPE", "SQUARE", "PORTRAIT_4_5", "STORY", "SLIDE_16_9", "BANNER"]).optional(),
    profile: z.enum(["SNAPSHOT", "DONOR_REPORT", "SOCIAL", "INTERNAL"]).optional(),
    language: z.enum(["en", "fr", "es", "ar"]).optional(),
    subtitle: z.string().max(160).optional(),
    mapDisclaimer: z.boolean().optional(),
    waivers: z.array(z.object({ ruleId: z.string().min(1).max(60), note: z.string().min(1).max(200) }).strict()).max(20).optional(),
    donorLogoAssetIds: z.array(z.string().min(1).max(64)).max(3).optional(),
    acknowledgement: z.string().max(200).optional(),
    coverAssetId: z.string().min(1).max(64).optional(),
    sections: z.array(InfographicSectionSchema).min(1).max(40),
  })
  .strict();

export const CreateInfographicSchema = z
  .object({
    title: z.string().max(120).optional(),
    templateId: z.enum(INFOGRAPHIC_TEMPLATE_IDS),
    /** Absent: start from the template's own default composition. */
    config: InfographicConfigSchema.optional(),
    /** Start from one of the organization's saved layouts instead. */
    userTemplateId: z.string().min(1).max(64).optional(),
  })
  .strict();

export const UpdateInfographicSchema = z
  .object({
    title: z.string().max(120).optional(),
    config: InfographicConfigSchema,
  })
  .strict();

const MapPointsSchema = z
  .array(
    z
      .object({
        name: z.string().max(120),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        worst: z.enum(["ON_TIME", "LATE", "DONE", "CANCELLED"]),
        count: z.number().int().min(1).max(999).optional(),
      })
      .strict(),
  )
  .max(400);

/** Outlines the browser resolved from the bundled boundaries; bounded so a request cannot carry a whole atlas. */
const MapShapesSchema = z
  .array(
    z
      .object({
        kind: z.enum(["COUNTRY", "REGION"]),
        name: z.string().max(120).optional(),
        value: z.number().finite().optional(),
        rings: z.array(z.array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])).max(4000)).max(200),
      })
      .strict(),
  )
  .max(120)
  .refine((shapes) => shapes.reduce((n, shape) => n + shape.rings.reduce((m, ring) => m + ring.length, 0), 0) <= 60_000, "The map outline is too detailed");

export const INFOGRAPHIC_EXPORT_FORMATS = ["PNG", "PDF", "SVG", "PPTX", "PACK"] as const;

export const ExportInfographicSchema = z
  .object({
    format: z.enum(INFOGRAPHIC_EXPORT_FORMATS),
    /** PNG pixel density: 1, 2 or 3 times the canvas. */
    scale: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    mapPoints: MapPointsSchema.optional(),
    mapShapes: MapShapesSchema.optional(),
  })
  .strict();

/** The Studio's live preview: the draft config (unsaved edits) plus the map the browser resolved. */
export const PreviewInfographicSchema = z
  .object({
    config: InfographicConfigSchema.optional(),
    mapPoints: MapPointsSchema.optional(),
    mapShapes: MapShapesSchema.optional(),
  })
  .strict();

/** An uploaded image as base64 (the Studio reads the chosen file in the browser). */
export const UploadInfographicAssetSchema = z
  .object({
    name: z.string().min(1).max(120),
    kind: z.enum(["IMAGE", "LOGO"]),
    credit: z.string().max(80).optional(),
    dataBase64: z.string().min(16).max(8_000_000),
  })
  .strict();

export const SaveBrandKitSchema = z
  .object({
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    logoAssetId: z.string().min(1).max(64).optional(),
    partnerLogoAssetIds: z.array(z.string().min(1).max(64)).max(6).optional(),
    footerLine: z.string().max(160).optional(),
    acknowledgement: z.string().max(200).optional(),
  })
  .strict();

export const SaveInfographicTemplateSchema = z
  .object({ name: z.string().min(1).max(80), description: z.string().max(200).optional(), infographicId: z.string().min(1).max(64) })
  .strict();

export const InfographicReviewActionSchema = z.object({ action: z.enum(["REQUEST_REVIEW", "APPROVE", "RETURN"]), note: z.string().max(300).optional() }).strict();

export const CreateInfographicShareLinkSchema = z.object({ exportId: z.string().min(1).max(64), days: z.number().int().min(1).max(90).optional() }).strict();

export const InfographicVariantsSchema = z
  .object({ by: z.enum(["LOCATION", "PERIOD", "LATEST_PERIOD"]) })
  .strict();

export const InfographicSuggestionsSchema = z.object({ language: z.enum(["en", "fr", "es", "ar"]).optional(), rounding: z.enum(["NONE", "HUNDREDS", "THOUSANDS"]).optional() }).strict();

export type CreateInfographicInput = z.infer<typeof CreateInfographicSchema>;
export type UpdateInfographicInput = z.infer<typeof UpdateInfographicSchema>;
export type ExportInfographicInput = z.infer<typeof ExportInfographicSchema>;
export type PreviewInfographicInput = z.infer<typeof PreviewInfographicSchema>;
export type UploadInfographicAssetInput = z.infer<typeof UploadInfographicAssetSchema>;
export type SaveBrandKitInput = z.infer<typeof SaveBrandKitSchema>;
export type SaveInfographicTemplateInput = z.infer<typeof SaveInfographicTemplateSchema>;
export type InfographicReviewActionInput = z.infer<typeof InfographicReviewActionSchema>;
export type CreateInfographicShareLinkInput = z.infer<typeof CreateInfographicShareLinkSchema>;
export type InfographicVariantsInput = z.infer<typeof InfographicVariantsSchema>;
export type InfographicSuggestionsInput = z.infer<typeof InfographicSuggestionsSchema>;
export type InfographicConfigInput = z.infer<typeof InfographicConfigSchema>;

/** Places a published infographic picture in a report section. */
export const AddSectionInfographicSchema = z.object({ exportId: z.string().min(1).max(64), caption: z.string().max(200).optional() }).strict();
export const CaptionSectionInfographicSchema = z.object({ caption: z.string().max(200) }).strict();
export const MoveSectionInfographicSchema = z.object({ direction: z.enum(["UP", "DOWN"]) }).strict();
export type AddSectionInfographicInput = z.infer<typeof AddSectionInfographicSchema>;
