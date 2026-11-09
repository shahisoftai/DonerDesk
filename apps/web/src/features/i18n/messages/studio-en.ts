/**
 * The Visual Studio's own text (Phase 48): the Data panel, live-data stamps and, as the batches land, the editing tools and guided
 * flows. Its own file so the area can grow without touching the main catalogue; the main catalogues spread it in, so every
 * language must carry every key (type check + i18n test). Counts are number-neutral so no plural tables are needed.
 */
export const studioEn = {
  "studio.data.title": "Data",
  "studio.data.search": "Search fields, for example “girls enrolled”",
  "studio.data.empty": "No field matches. Try fewer or different words.",
  "studio.data.notConnected": "Being connected",
  "studio.data.fieldComing": "Not available yet",
  "studio.data.noAccess": "Your role cannot open this",
  "studio.data.guestOk": "Shown on share links",
  "studio.data.guestNo": "Not shown on share links",
  "studio.data.measure": "Figure",
  "studio.data.dimension": "Group by",
  "studio.data.perRow": "One row is {grain}",
  "studio.data.preview": "View data",
  "studio.data.unavailable": "This cannot be shown: {reason}",
  "studio.live.updatedSeconds": "Updated {value} s ago",
  "studio.live.updatedMinutes": "Updated {value} min ago",
  "studio.live.updatedHours": "Updated {value} h ago",
  "studio.live.updatedDays": "Updated {value} d ago",
  "studio.live.refresh": "Refresh",
  "studio.live.offline": "Offline: showing the last figures",
  "studio.live.changed": "Figures changed",
} as const;
