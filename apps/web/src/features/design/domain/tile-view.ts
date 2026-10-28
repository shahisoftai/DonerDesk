/**
 * What a tile shows (Phase 34.0). Every dashboard widget, home tile and map panel is a tile with one of five states; this decides
 * what the body says so no surface invents its own wording. Pure: copy is returned as message keys, never English sentences.
 * An empty tile says it is "not yet reported", never a placeholder figure; a restricted one says so and is never drawn.
 */

export type TileStatus = "loading" | "ready" | "empty" | "error" | "restricted";

export interface TileInput {
  status: TileStatus;
  /** Values shown that are not verified yet (a draft is plotted, and says so). */
  unverified?: number | undefined;
  /** A retry is possible (the screen can load it again). */
  canRetry?: boolean | undefined;
  /** The date the figures stand at, already formatted by the screen. */
  asOf?: string | undefined;
  /** Filters set on the dashboard that this tile does not honour. */
  notFiltered?: boolean | undefined;
}

export interface TileView {
  status: TileStatus;
  /** True when the screen's own content is drawn in the body. */
  showContent: boolean;
  /** The one sentence shown instead of content, as a message key (none when the content is drawn). */
  messageKey: string | null;
  /** A second, smaller line under the message. */
  hintKey: string | null;
  showRetry: boolean;
  /** Footer lines in order. `plural` keys take a count. */
  footer: Array<{ key: string; count?: number; asOf?: string }>;
  /** Screen readers: loading and errors are announced politely. */
  live: "polite" | "off";
}

export function tileView(input: TileInput): TileView {
  const footer: TileView["footer"] = [];
  const unverified = Math.max(0, Math.trunc(input.unverified ?? 0));
  const drawn = input.status === "ready";
  if (drawn && input.asOf) footer.push({ key: "tile.asOf", asOf: input.asOf });
  if (drawn && unverified > 0) footer.push({ key: "tile.unverified", count: unverified });
  if (input.notFiltered) footer.push({ key: "tile.notFiltered" });
  switch (input.status) {
    case "ready":
      return { status: "ready", showContent: true, messageKey: null, hintKey: null, showRetry: false, footer, live: "off" };
    case "loading":
      return { status: "loading", showContent: false, messageKey: "tile.loading", hintKey: null, showRetry: false, footer, live: "polite" };
    case "empty":
      return { status: "empty", showContent: false, messageKey: "tile.empty", hintKey: "tile.emptyHint", showRetry: false, footer, live: "off" };
    case "error":
      return { status: "error", showContent: false, messageKey: "tile.error", hintKey: null, showRetry: Boolean(input.canRetry), footer, live: "polite" };
    case "restricted":
      return { status: "restricted", showContent: false, messageKey: "tile.restricted", hintKey: null, showRetry: false, footer, live: "off" };
  }
}
