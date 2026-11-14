/**
 * Drag-and-drop reordering and "Move to" on the logframe page are on by default: they are the only way to repair a hierarchy.
 * `LOGFRAME_DND_ENABLED=0|false` turns them off.
 */
export function isLogframeReorderEnabled(envValue: string | undefined = process.env.LOGFRAME_DND_ENABLED): boolean {
  const v = envValue?.toLowerCase();
  return !(v === "0" || v === "false");
}
