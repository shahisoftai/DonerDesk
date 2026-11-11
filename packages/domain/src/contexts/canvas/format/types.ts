/**
 * The formatting a block can carry (Phase 50.2). Each capability is a named group of settings with its own checker; a block declares
 * which capabilities it supports (`formatsOf`), and the editor shows only those sections. Colours are theme roles, never raw hex, except
 * a person's custom colour, which the checker tests for contrast. Nothing here can switch off an honesty rule: a gap is never coloured,
 * a rate is never judged as a share of target.
 */
export const FORMAT_CAPABILITIES = [
  "title", "frame", "accentBar", "numbers", "callout", "referenceLabels", "labels", "legend", "colors", "conditional",
  "table", "tooltip", "emptyData", "visibility",
] as const;
export type FormatCapability = (typeof FORMAT_CAPABILITIES)[number];

/** Theme colour roles a setting may name; `good`/`bad`/`neutral` are the semantic ones rules use. */
export const COLOUR_ROLES = ["accent", "accent2", "ink", "body", "muted", "good", "bad", "neutral", "warn", "viz1", "viz2", "viz3", "viz4", "viz5", "viz6", "viz7", "viz8"] as const;
export type ColourRole = (typeof COLOUR_ROLES)[number];
/** A colour setting: a theme role, or a custom `#rrggbb` the checker tests against the card. */
export type ColourChoice = { role: ColourRole } | { hex: string };

export const SIDES = ["start", "end", "top", "bottom"] as const;
export type Side = (typeof SIDES)[number];
export const TEXT_ALIGNMENTS = ["start", "center", "end"] as const;
export type TextAlignment = (typeof TEXT_ALIGNMENTS)[number];

export interface TitleFormat { show?: boolean; subtitle?: string; size?: "S" | "M" | "L" | "XL"; weight?: "regular" | "bold"; color?: ColourChoice; align?: TextAlignment; rule?: boolean }
export interface FrameFormat { borderSide?: "all" | Side; borderWidth?: number; borderColor?: ColourChoice; padding?: { top: number; end: number; bottom: number; start: number } }
export interface AccentBarFormat { show?: boolean; side?: Side; thickness?: number; color?: ColourChoice }
export const DISPLAY_UNITS = ["AUTO", "NONE", "K", "M", "B"] as const;
export type DisplayUnit = (typeof DISPLAY_UNITS)[number];
export interface NumbersFormat { units?: DisplayUnit; decimals?: number; prefix?: string; suffix?: string; separators?: boolean; negative?: "minus" | "parentheses" }
export interface CalloutFormat { size?: "M" | "L" | "XL" | "XXL"; weight?: "regular" | "bold"; color?: ColourChoice; labelPosition?: "below" | "above" | "start"; labelColor?: ColourChoice }
export interface ReferenceLabelsFormat { show?: boolean; layout?: "row" | "column"; divider?: boolean; color?: ColourChoice }
export interface LabelsFormat { show?: boolean; position?: "inside" | "outside" | "auto"; density?: "auto" | "all" | "none"; size?: "S" | "M" | "L" }
export interface LegendFormat { show?: boolean; position?: "top" | "bottom" | "start" | "end"; title?: string }
export interface ColorsFormat { series?: ColourChoice[] }

export const CONDITIONAL_KINDS = ["GRADIENT", "RULES", "ICONS", "DATA_BARS"] as const;
export type ConditionalKind = (typeof CONDITIONAL_KINDS)[number];
export const RULE_OPERATORS = ["GTE", "GT", "LT", "LTE", "BETWEEN", "EQ"] as const;
export type RuleOperator = (typeof RULE_OPERATORS)[number];
export interface ConditionalBand { op: RuleOperator; value: number; to?: number; color: ColourChoice; icon?: ConditionalIcon }
export const CONDITIONAL_ICONS = ["UP", "DOWN", "FLAT", "DOT", "FLAG", "CHECK", "CROSS"] as const;
export type ConditionalIcon = (typeof CONDITIONAL_ICONS)[number];
export type ConditionalRule =
  | { kind: "GRADIENT"; target: "background" | "text"; min: ColourChoice; mid?: ColourChoice; max: ColourChoice; minValue?: number; maxValue?: number }
  | { kind: "RULES"; target: "background" | "text"; bands: ConditionalBand[] }
  | { kind: "ICONS"; bands: ConditionalBand[] }
  | { kind: "DATA_BARS"; color: ColourChoice; showValue?: boolean };
export interface ConditionalFormat { rules: ConditionalRule[] }

export const TOTAL_FUNCTIONS = ["NONE", "SUM", "AVERAGE", "MIN", "MAX", "COUNT", "DISTINCT"] as const;
export type TotalFunction = (typeof TOTAL_FUNCTIONS)[number];
export interface TableColumnFormat { key: string; width?: "FIT" | "GROW" | number; total?: TotalFunction; hideOnPhone?: boolean; align?: TextAlignment }
export interface TableFormat { gridlines?: "none" | "horizontal" | "both"; banded?: boolean; headerFill?: ColourChoice; wrap?: boolean; stickyHeader?: boolean; columns?: TableColumnFormat[] }
export interface TooltipFormat { show?: boolean; indicatorIds?: string[] }
export interface EmptyDataFormat { showItemsWithNoData?: boolean; message?: string }
export interface VisibilityFormat { hideOnPhone?: boolean; hideOnPrint?: boolean; hideOnShareLink?: boolean }

export interface BlockFormat {
  title?: TitleFormat; frame?: FrameFormat; accentBar?: AccentBarFormat; numbers?: NumbersFormat; callout?: CalloutFormat;
  referenceLabels?: ReferenceLabelsFormat; labels?: LabelsFormat; legend?: LegendFormat; colors?: ColorsFormat;
  conditional?: ConditionalFormat; table?: TableFormat; tooltip?: TooltipFormat; emptyData?: EmptyDataFormat; visibility?: VisibilityFormat;
}
