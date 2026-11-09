/**
 * The shapes of a chart's `style` block (Phase 47). Every group and field is optional: absent means the builder's own look. A style holds
 * choices only (numbers, words, on/off), never data and never a function, so it is stored with the spec and drawn the same on screen and
 * in an export. The rules for each field live in `chart-style-fields.ts`.
 */

export type StyleTitleAlign = "LEFT" | "CENTER" | "RIGHT";
export type StyleFontWeight = "NORMAL" | "BOLD";
export type StyleSymbol = "CIRCLE" | "RECT" | "ROUND_RECT" | "TRIANGLE" | "DIAMOND" | "NONE";
export type StyleLegendIcon = "CIRCLE" | "RECT" | "ROUND_RECT" | "TRIANGLE" | "DIAMOND";
export type StyleLabelPosition = "AUTO" | "TOP" | "BOTTOM" | "LEFT" | "RIGHT" | "INSIDE" | "OUTSIDE";
export type StyleLineKind = "DEFAULT" | "NONE" | "SOLID" | "DASHED" | "DOTTED";
export type StyleTone = "NEGATIVE" | "NEUTRAL" | "POSITIVE";
export type StyleRamp = "DEFAULT" | "BLUE" | "GREEN" | "WARM" | "PURPLE" | "GREY";
export type StyleEasing = "LINEAR" | "CUBIC_OUT" | "QUINTIC_OUT" | "ELASTIC_OUT" | "BOUNCE_OUT";

/** Settings for one axis on the screen (horizontal or vertical; on a horizontal bar chart the values run along the horizontal one). */
export interface StyleAxis {
  labelSize?: number | undefined;
  rotate?: number | undefined;
  interval?: "AUTO" | "ALL" | undefined;
  /** Longest label in pixels before it is cut with an ellipsis. */
  truncate?: number | undefined;
  tickCount?: number | undefined;
  showTicks?: boolean | undefined;
  showLine?: boolean | undefined;
  gridlines?: StyleLineKind | undefined;
  bands?: boolean | undefined;
  /** Written before and after each value on a value axis (a currency sign, a unit). */
  prefix?: string | undefined;
  suffix?: string | undefined;
  nameSize?: number | undefined;
  nameGap?: number | undefined;
}

export interface StyleGaugeBand { upTo: number; tone: StyleTone }

export interface ChartStyle {
  text?: { size?: number | undefined } | undefined;
  frame?: { background?: "NONE" | "SURFACE" | "TINT" | undefined } | undefined;
  title?: { align?: StyleTitleAlign | undefined; size?: number | undefined; weight?: StyleFontWeight | undefined; position?: "TOP" | "BOTTOM" | undefined; subtitleSize?: number | undefined } | undefined;
  /** Space around the plot, in pixels. */
  grid?: { left?: number | undefined; right?: number | undefined; top?: number | undefined; bottom?: number | undefined } | undefined;
  /** Settings for both axes at once; `xAxis` and `yAxis` override them per axis. */
  axisLabels?: { size?: number | undefined; rotate?: number | undefined } | undefined;
  xAxis?: StyleAxis | undefined;
  yAxis?: StyleAxis | undefined;
  bars?: { width?: number | undefined; gap?: number | undefined; radius?: number | undefined; gradient?: boolean | undefined; track?: boolean | undefined; borderWidth?: number | undefined } | undefined;
  lines?: { width?: number | undefined; smooth?: boolean | undefined; symbol?: StyleSymbol | undefined; symbolSize?: number | undefined; showSymbols?: "AUTO" | "ALWAYS" | "NEVER" | undefined; roundCaps?: boolean | undefined } | undefined;
  area?: { opacity?: number | undefined; fade?: boolean | undefined } | undefined;
  /** Percent of the drawing area. A pie has only an outer radius; a donut keeps its hole unless an inner radius is given. */
  pie?: { innerRadius?: number | undefined; outerRadius?: number | undefined; startAngle?: number | undefined; clockwise?: boolean | undefined; rose?: "NONE" | "RADIUS" | "AREA" | undefined; sliceGap?: number | undefined; sliceRadius?: number | undefined; minAngle?: number | undefined; labelLines?: boolean | undefined } | undefined;
  /** Which icon a pictorial chart or a fill gauge draws. */
  pictorial?: { icon?: "PERSON" | "HOUSE" | "DROP" | "CIRCLE" | "SQUARE" | undefined } | undefined;
  points?: { symbol?: StyleSymbol | undefined; size?: number | undefined } | undefined;
  labels?: { size?: number | undefined; weight?: StyleFontWeight | undefined; position?: StyleLabelPosition | undefined; rotate?: number | undefined; hideOverlap?: boolean | undefined } | undefined;
  legend?: { icon?: StyleLegendIcon | undefined; size?: number | undefined; orient?: "HORIZONTAL" | "VERTICAL" | undefined; gap?: number | undefined; mode?: "PLAIN" | "SCROLL" | undefined; selectable?: boolean | undefined } | undefined;
  tooltip?: { trigger?: "AUTO" | "ITEM" | "AXIS" | undefined; pointer?: "NONE" | "LINE" | "SHADOW" | "CROSS" | undefined; size?: number | undefined; confine?: boolean | undefined } | undefined;
  /** Highest, lowest, average and latest value marked on the plot. Never drawn for a stack, whose parts are not a total. */
  marks?: { max?: boolean | undefined; min?: boolean | undefined; average?: boolean | undefined; latest?: boolean | undefined } | undefined;
  effects?: { shadow?: boolean | undefined; opacity?: number | undefined; hover?: "SERIES" | "SELF" | "NONE" | undefined; decals?: boolean | undefined } | undefined;
  gauge?: { width?: number | undefined; startAngle?: number | undefined; endAngle?: number | undefined; pointer?: boolean | undefined; ticks?: boolean | undefined; scaleLabels?: boolean | undefined; detailSize?: number | undefined; bands?: StyleGaugeBand[] | undefined } | undefined;
  heat?: { ramp?: StyleRamp | undefined; steps?: number | undefined; cellBorder?: boolean | undefined; showScale?: boolean | undefined } | undefined;
  radar?: { shape?: "POLYGON" | "CIRCLE" | undefined; areaOpacity?: number | undefined } | undefined;
  funnel?: { gap?: number | undefined; align?: "LEFT" | "CENTER" | "RIGHT" | undefined } | undefined;
  flow?: { nodeWidth?: number | undefined; nodeGap?: number | undefined; curveness?: number | undefined } | undefined;
  map?: { borders?: boolean | undefined; borderWidth?: number | undefined; labels?: boolean | undefined; opacity?: number | undefined; symbolScale?: number | undefined; roam?: boolean | undefined } | undefined;
  /** Screen only: a chart in a report or an export never carries zoom bars or a toolbox. */
  interaction?: { zoom?: "NONE" | "SLIDER" | "INSIDE" | "BOTH" | undefined; toolbox?: boolean | undefined } | undefined;
  animation?: { enabled?: boolean | undefined; duration?: number | undefined; easing?: StyleEasing | undefined; stagger?: number | undefined } | undefined;
}

export type StyleGroup = keyof ChartStyle;
