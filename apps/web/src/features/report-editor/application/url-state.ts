/**
 * Deep-link state for the report editor: which section is selected, which
 * inspector panel is open, and which statement is focused. Lives in the URL so
 * Smart Review items, notifications and emails can open the exact spot, and so
 * browser Back works between selections.
 */

export const INSPECTOR_PANELS = ["statements", "sources", "chart", "comments", "checks"] as const;
export type InspectorPanel = (typeof INSPECTOR_PANELS)[number];

export type EditorUrlState = {
  section?: string;
  panel?: InspectorPanel;
  claim?: string;
};

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function read(source: ParamSource, key: string): string | undefined {
  if (source instanceof URLSearchParams) return source.get(key) ?? undefined;
  const value = source[key];
  return Array.isArray(value) ? value[0] : value;
}

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function parseEditorUrlState(source: ParamSource): EditorUrlState {
  const section = read(source, "section");
  const panel = read(source, "panel");
  const claim = read(source, "claim");
  return {
    section: section && ID_RE.test(section) ? section : undefined,
    panel: INSPECTOR_PANELS.find((p) => p === panel),
    claim: claim && ID_RE.test(claim) ? claim : undefined,
  };
}

/**
 * Serialises editor state into a query string, preserving unrelated params
 * (e.g. `editor=v2`). Returns the string without a leading "?" (empty when
 * nothing is set).
 */
export function serializeEditorUrlState(state: EditorUrlState, base?: URLSearchParams): string {
  const params = new URLSearchParams(base ? base.toString() : "");
  for (const key of ["section", "panel", "claim", "view"]) params.delete(key);
  if (state.section) params.set("section", state.section);
  if (state.panel) params.set("panel", state.panel);
  if (state.claim) params.set("claim", state.claim);
  return params.toString();
}
