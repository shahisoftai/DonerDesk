/**
 * A `ProjectReadiness` blocker's `href` is a bare, project-relative path
 * (e.g. "/templates", "/reporting-profile") — it has no project id, since the
 * readiness service is project-agnostic. Resolve it into a real route before
 * handing it to `<Link>`; passed to `<Link>` unresolved it navigates to that
 * path at the site root instead of under `/projects/{id}`.
 */
export function blockerHref(projectId: string, href: string): string {
  if (href === "/reporting-profile") return `/projects/${projectId}/setup/profile`;
  if (href.startsWith("/")) return `/projects/${projectId}${href}`;
  return href;
}
