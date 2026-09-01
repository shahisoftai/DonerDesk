/**
 * Parse environment-driven feature flags. Booleans commonly arrive as
 * `1 | true | on | yes | enabled` (case-insensitive) and we want a single
 * canonical predicate so the AI Reporter enablement cannot be silently
 * ignored because an operator wrote `AI_REPORTER_ENABLED=true` in
 * /opt/donordesk/shared/api.env.
 */
export function isTruthyFlag(value: string | undefined | null): boolean {
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return false;
  return normalized === "1" ||
    normalized === "true" ||
    normalized === "on" ||
    normalized === "yes" ||
    normalized === "enabled";
}