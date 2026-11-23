import type { FastifyReply, FastifyRequest } from "fastify";
import { DomainError } from "@donordesk/domain";

/**
 * Deny-by-default routes for a restricted role (Phase 63c). The permission table (`authorization.ts`) says what a permission may reach;
 * this says which routes a restricted role may call at all, so a route added tomorrow, or a read that only needs "can view the
 * project", is closed to that role until someone lists it here. It is the server-side twin of the web's `ROLE_REACHABLE_PAGES`
 * (the screens a role may open) and works like `EXTERNAL_ALLOWED` for outside partners. A role with no row is not restricted, so every
 * other role behaves as before; a new restricted role is a row, never a branch.
 *
 * `ROLE_ROUTE_MODE=audit` logs what would be refused and lets it through (how a new list is checked against real use before it is
 * enforced); anything else enforces.
 */
export interface RouteRule { method: string; route: RegExp }

const FIELD_OFFICER_ALLOWED: ReadonlyArray<RouteRule> = [
  // The person and the shell around every page.
  { method: "GET", route: /^\/v1\/(organization|dashboard|me\/week|me\/assignments|me\/notification-preferences|notifications|legal\/consent)$/ },
  { method: "PUT", route: /^\/v1\/me\/notification-preferences$/ },
  { method: "POST", route: /^\/v1\/(legal\/consent|notifications\/[^/]+\/read)$/ },
  { method: "GET", route: /^\/v1\/projects(\/[^/]+)?$/ },
  { method: "GET", route: /^\/v1\/projects\/[^/]+\/(reporting-profile|people|logframe|reporting-periods)$/ },
  { method: "GET", route: /^\/v1\/(bookmarks|home-pins)$/ },
  { method: "POST", route: /^\/v1\/bookmarks$/ },
  { method: "DELETE", route: /^\/v1\/bookmarks\/[^/]+$/ },
  // Their own work plan and activities.
  { method: "GET", route: /^\/v1\/projects\/[^/]+\/(work-plan|plan-fields|plan-field-values|activities|risks)$/ },
  { method: "GET", route: /^\/v1\/work-plan\/[^/]+\/(revisions|fields|places|people|progress|progress\/prepare)$/ },
  { method: "PUT", route: /^\/v1\/work-plan\/[^/]+(\/(status|indicators|places|people))?$/ },
  { method: "POST", route: /^\/v1\/work-plan\/[^/]+\/(progress|complete)$/ },
  { method: "DELETE", route: /^\/v1\/work-plan\/[^/]+\/progress\/[^/]+$/ },
  { method: "POST", route: /^\/v1\/activities(\/polish|\/(attach|detach)-evidence|\/[^/]+\/resubmit)?$/ },
  { method: "PATCH", route: /^\/v1\/activities\/[^/]+$/ },
  { method: "GET", route: /^\/v1\/activities\/[^/]+(\/file-needs)?$/ },
  { method: "GET", route: /^\/v1\/(activities|indicators)\/[^/]+\/evidence-support$/ },
  { method: "POST", route: /^\/v1\/projects\/[^/]+\/risks$/ },
  { method: "PUT", route: /^\/v1\/risks\/[^/]+$/ },
  { method: "POST", route: /^\/v1\/risks\/[^/]+\/close$/ },
  { method: "POST", route: /^\/v1\/tasks\/[^/]+\/complete$/ },
  { method: "GET", route: /^\/v1\/comments$/ },
  { method: "POST", route: /^\/v1\/comments(\/[^/]+\/(resolve|reopen))?$/ },
  // People they registered (the handler keeps it to their own).
  { method: "GET", route: /^\/v1\/projects\/[^/]+\/beneficiaries$/ },
  { method: "POST", route: /^\/v1\/projects\/[^/]+\/beneficiaries$/ },
  { method: "PUT", route: /^\/v1\/beneficiaries\/[^/]+$/ },
  { method: "DELETE", route: /^\/v1\/beneficiaries\/[^/]+$/ },
  // Photos and files they bring in; reading one by id still follows the file's own confidentiality. No search, no library.
  { method: "POST", route: /^\/v1\/evidence\/(upload|link-drive|[^/]+\/accept-tags)$/ },
  { method: "GET", route: /^\/v1\/evidence\/[^/]+(\/suggest-links)?$/ },
  { method: "GET", route: /^\/v1\/files\/[^/]+$/ },
  // The forms they fill in, their drafts and the facilities given to them.
  { method: "GET", route: /^\/v1\/projects\/[^/]+\/(collection-forms|offline-pack|offline-basemap)$/ },
  { method: "GET", route: /^\/v1\/collection-forms\/[^/]+(\/(prefill|draft))?$/ },
  { method: "POST", route: /^\/v1\/collection-forms\/[^/]+\/(records|files)$/ },
  { method: "PUT", route: /^\/v1\/collection-forms\/[^/]+\/draft$/ },
  { method: "DELETE", route: /^\/v1\/collection-forms\/[^/]+\/draft$/ },
  { method: "GET", route: /^\/v1\/me\/(collection-drafts|facility-assignments)$/ },
  { method: "POST", route: /^\/v1\/collection-assignments\/[^/]+\/move$/ },
  // Places for the picker (the organisation's list is reference data: names and levels, no records; the offline download is scoped to their own work), the map of their work and where their own records happened.
  { method: "GET", route: /^\/v1\/places$/ },
  { method: "GET", route: /^\/v1\/projects\/[^/]+\/(places|entry-places|places\/[^/]+\/agenda)$/ },
  { method: "GET", route: /^\/v1\/projects\/[^/]+\/record-places\/[^/]+\/[^/]+$/ },
  { method: "PUT", route: /^\/v1\/projects\/[^/]+\/record-places\/[^/]+\/[^/]+$/ },
  { method: "GET", route: /^\/v1\/organization\/(map-layer|map-layer\/data|boundary-layers|boundary-layers\/[^/]+\/[^/]+\/data|map-context|facility-types)$/ },
];

/** Roles with a list. Every other role is unrestricted here (its limits are the permission table's and the project boundary's). */
export const ROLE_ROUTE_ALLOWLISTS: Readonly<Record<string, ReadonlyArray<RouteRule>>> = {
  FIELD_OFFICER: FIELD_OFFICER_ALLOWED,
};

export function isRestrictedToRoutes(role: string): boolean {
  return role in ROLE_ROUTE_ALLOWLISTS;
}

export function isRouteAllowedForRole(role: string, method: string, path: string): boolean {
  const list = ROLE_ROUTE_ALLOWLISTS[role];
  if (!list) return true;
  const m = method === "HEAD" ? "GET" : method;
  return list.some((rule) => rule.method === m && rule.route.test(path));
}

export async function roleRouteAccessMiddleware(req: FastifyRequest, _reply: FastifyReply) {
  const role = String(req.tenant.role);
  if (!isRestrictedToRoutes(role)) return;
  const path = req.url.split("?", 1)[0] ?? req.url;
  if (isRouteAllowedForRole(role, req.method, path)) return;
  if (process.env.ROLE_ROUTE_MODE === "audit") {
    req.log.warn({ role, method: req.method, path }, "role-route-would-be-refused");
    return;
  }
  throw DomainError.forbidden("This is not part of your work.");
}
