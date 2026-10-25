function isFlagOn(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}

/**
 * Report Editor v2 (document-first workspace) rollout switch.
 *
 * `REPORT_EDITOR_V2=1|true` enables it for everyone; the `?editor=v2` /
 * `?editor=classic` query parameter overrides the default per request so the
 * new editor can be tried (and the classic one reached) during rollout.
 */
export function isReportEditorV2Enabled(query: string | undefined, envValue: string | undefined = process.env.REPORT_EDITOR_V2): boolean {
  if (query === "v2") return true;
  if (query === "classic") return false;
  return isFlagOn(envValue);
}

/**
 * Drag-and-drop reordering and "Move to" on the logframe page are on by default: they are the only way to repair a hierarchy.
 * `LOGFRAME_DND_ENABLED=0|false` turns them off.
 */
export function isLogframeReorderEnabled(envValue: string | undefined = process.env.LOGFRAME_DND_ENABLED): boolean {
  const v = envValue?.toLowerCase();
  return !(v === "0" || v === "false");
}
