/** Icon shapes for pictorial charts, as vector paths the chart library draws at any size (Phase 47). The same path is used on screen and in an export. */
export const ICON_PATHS = {
  PERSON: "path://M12 3a3 3 0 1 1 0 6a3 3 0 0 1 0-6zM6 22v-7a6 6 0 0 1 12 0v7z",
  HOUSE: "path://M12 3L2 12h3v9h5v-6h4v6h5v-9h3z",
  DROP: "path://M12 2C12 2 5 10 5 15a7 7 0 0 0 14 0C19 10 12 2 12 2z",
  CIRCLE: "circle",
  SQUARE: "roundRect",
} as const;
export type IconName = keyof typeof ICON_PATHS;
