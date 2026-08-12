import type { FastifyReply, FastifyRequest } from "fastify";
import { Permissions, type Permission } from "@donordesk/domain";

const RULES: ReadonlyArray<{
  method: string;
  route: RegExp;
  permission: Permission;
}> = [
  { method: "GET", route: /^\/v1\/organization$/, permission: "project.view" },
  { method: "PUT", route: /^\/v1\/organization$/, permission: "org.manage" },
  { method: "GET", route: /^\/v1\/users$/, permission: "users.manage" },
  { method: "POST", route: /^\/v1\/users\/(invite|role)$/, permission: "users.manage" },
  { method: "POST", route: /^\/v1\/projects$/, permission: "project.create" },
  { method: "GET", route: /^\/v1\/projects(?:\/[^/]+)?$/, permission: "project.view" },
  { method: "PUT", route: /^\/v1\/projects\/[^/]+$/, permission: "project.edit" },
  { method: "POST", route: /^\/v1\/templates$/, permission: "template.manage" },
  { method: "GET", route: /^\/v1\/projects\/[^/]+\/templates$/, permission: "project.view" },
  { method: "PUT", route: /^\/v1\/templates\/[^/]+\/sections$/, permission: "template.manage" },
  { method: "POST", route: /^\/v1\/logframe-items$/, permission: "logframe.manage" },
  { method: "GET", route: /^\/v1\/projects\/[^/]+\/logframe$/, permission: "project.view" },
  { method: "POST", route: /^\/v1\/indicators$/, permission: "logframe.manage" },
  { method: "POST", route: /^\/v1\/indicator-updates$/, permission: "indicator.update" },
  { method: "POST", route: /^\/v1\/indicator-updates\/[^/]+\/verify$/, permission: "indicator.verify" },
  { method: "POST", route: /^\/v1\/evidence\/upload$/, permission: "evidence.upload" },
  { method: "POST", route: /^\/v1\/evidence\/[^/]+\/accept-tags$/, permission: "evidence.upload" },
  { method: "POST", route: /^\/v1\/evidence\/[^/]+\/verify$/, permission: "evidence.verify" },
  { method: "POST", route: /^\/v1\/activities$/, permission: "activity.create" },
  { method: "GET", route: /^\/v1\/projects\/[^/]+\/activities$/, permission: "project.view" },
  { method: "GET", route: /^\/v1\/activities\/[^/]+$/, permission: "project.view" },
  { method: "POST", route: /^\/v1\/activities\/polish$/, permission: "activity.create" },
  { method: "POST", route: /^\/v1\/activities\/review$/, permission: "activity.approve" },
  { method: "GET", route: /^\/v1\/evidence\/[^/]+$/, permission: "project.view" },
  { method: "POST", route: /^\/v1\/reporting-periods$/, permission: "report.edit" },
  { method: "GET", route: /^\/v1\/projects\/[^/]+\/reporting-periods$/, permission: "project.view" },
  { method: "POST", route: /^\/v1\/reporting-periods\/[^/]+\/generate-draft$/, permission: "report.generate" },
  { method: "GET", route: /^\/v1\/reporting-periods\/[^/]+\/draft$/, permission: "report.edit" },
  { method: "PUT", route: /^\/v1\/report-sections\/[^/]+$/, permission: "report.edit" },
  { method: "POST", route: /^\/v1\/report-sections\/[^/]+\/approve$/, permission: "report.approve" },
  { method: "POST", route: /^\/v1\/report-drafts\/[^/]+\/submit-for-review$/, permission: "report.edit" },
  { method: "POST", route: /^\/v1\/report-drafts\/[^/]+\/approve$/, permission: "report.approve" },
  { method: "POST", route: /^\/v1\/reporting-periods\/[^/]+\/detect-missing$/, permission: "checklist.manage" },
  { method: "POST", route: /^\/v1\/checklist\/[^/]+\/resolve$/, permission: "checklist.manage" },
  { method: "POST", route: /^\/v1\/exports$/, permission: "report.export" },
  { method: "GET", route: /^\/v1\/reporting-periods\/[^/]+\/export-preflight$/, permission: "report.export" },
  { method: "GET", route: /^\/v1\/projects\/[^/]+\/exports$/, permission: "report.export" },
  { method: "POST", route: /^\/v1\/comments(?:\/[^/]+\/resolve)?$/, permission: "comment.create" },
  { method: "GET", route: /^\/v1\/audit-log$/, permission: "audit.view" },
];

export async function authorizationMiddleware(req: FastifyRequest, _reply: FastifyReply) {
  const path = req.url.split("?", 1)[0] ?? req.url;
  const rule = RULES.find((candidate) => candidate.method === req.method && candidate.route.test(path));
  if (rule) Permissions.require(req.tenant.role, rule.permission);
}
