/**
 * The chart library with only what DonorDesk draws (Phase 51). The full build is 1.1 MB of JavaScript that every page with a chart parses; this
 * registers the series and components our builders emit (`chart-render.ts`, `chart-style*.ts`) and nothing else. The build aliases
 * `echarts` to this file for the browser (`next.config.mjs`), so every `import("echarts")` gets it.
 *
 * Adding a chart type to the domain without adding it here makes that chart draw nothing: `echarts-slim.test.mts` builds every drawable chart kind
 * and fails when a series or component it uses is not in these lists.
 */
import * as echarts from "echarts/core";
import {
  BarChart, BoxplotChart, CustomChart, FunnelChart, GaugeChart, GraphChart, HeatmapChart, LineChart, MapChart, ParallelChart, PictorialBarChart, PieChart,
  RadarChart, SankeyChart, ScatterChart, SunburstChart, ThemeRiverChart, TreeChart, TreemapChart,
} from "echarts/charts";
import {
  AriaComponent, AxisPointerComponent, CalendarComponent, DataZoomComponent, DatasetComponent, GeoComponent, GraphicComponent, GridComponent, LegendComponent,
  MarkAreaComponent, MarkLineComponent, MarkPointComponent, ParallelComponent, PolarComponent, RadarComponent, SingleAxisComponent, TitleComponent, ToolboxComponent,
  TooltipComponent, VisualMapComponent,
} from "echarts/components";
import { LabelLayout, UniversalTransition } from "echarts/features";
import { CanvasRenderer, SVGRenderer } from "echarts/renderers";

/** The series types registered below (the test compares these with what the builders emit). */
export const REGISTERED_SERIES = ["bar", "boxplot", "custom", "funnel", "gauge", "graph", "heatmap", "line", "map", "parallel", "pictorialBar", "pie", "radar", "sankey", "scatter", "sunburst", "themeRiver", "tree", "treemap"] as const;
/** The option keys that need a component registered (axes come with the grid, polar and single-axis components). */
export const REGISTERED_COMPONENTS = ["angleAxis", "aria", "axisPointer", "calendar", "dataZoom", "dataset", "geo", "graphic", "grid", "legend", "markArea", "markLine", "markPoint", "parallel", "parallelAxis", "polar", "radar", "radiusAxis", "singleAxis", "title", "toolbox", "tooltip", "visualMap", "xAxis", "yAxis"] as const;

echarts.use([
  BarChart, BoxplotChart, CustomChart, FunnelChart, GaugeChart, GraphChart, HeatmapChart, LineChart, MapChart, ParallelChart, PictorialBarChart, PieChart,
  RadarChart, SankeyChart, ScatterChart, SunburstChart, ThemeRiverChart, TreeChart, TreemapChart,
  AriaComponent, AxisPointerComponent, CalendarComponent, DataZoomComponent, DatasetComponent, GeoComponent, GraphicComponent, GridComponent, LegendComponent,
  MarkAreaComponent, MarkLineComponent, MarkPointComponent, ParallelComponent, PolarComponent, RadarComponent, SingleAxisComponent, TitleComponent, ToolboxComponent,
  TooltipComponent, VisualMapComponent, LabelLayout, UniversalTransition, CanvasRenderer, SVGRenderer,
]);

export * from "echarts/core";
