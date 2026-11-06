// A save hands out `updatedAt` as the version the page quotes on its next save, so the repository must STORE that value:
// Prisma's @updatedAt stamps its own clock when the field is not written, which made the second save of a session a false conflict.
import test from "node:test";
import assert from "node:assert/strict";
import { PrismaDashboardRepository, PrismaSavedChartRepository, PrismaDashboardTemplateRepository, PrismaSavedReportRepository } from "../dist/repositories/dashboards.js";
import { TenantId } from "@donordesk/domain";

const tenantId = TenantId.create("11111111-1111-1111-1111-111111111111");
const at = new Date("2026-11-05T10:00:00.123Z");
const recorder = (model) => { const calls = []; return { calls, prisma: { [model]: { updateMany: async (args) => { calls.push(args); return { count: 1 }; } } } }; };

test("dashboard, saved chart, template and saved report writes store the version the handler returned", async () => {
  let r = recorder("dashboard");
  await new PrismaDashboardRepository(r.prisma).update({ id: "d", tenantId, scope: "MINE", ownerId: "u", name: "n", widgets: [], createdAt: at, updatedAt: at }, new Date(0));
  assert.equal(r.calls[0].data.updatedAt, at);
  r = recorder("savedChart");
  await new PrismaSavedChartRepository(r.prisma).update({ id: "c", tenantId, scope: "MINE", ownerId: "u", name: "n", spec: {}, versions: [], createdAt: at, updatedAt: at }, new Date(0));
  assert.equal(r.calls[0].data.updatedAt, at);
  r = recorder("dashboardTemplate");
  await new PrismaDashboardTemplateRepository(r.prisma).update({ id: "t", tenantId, ownerId: "u", template: { sector: "x", title: "t", revision: 1 }, createdAt: at, updatedAt: at }, new Date(0));
  assert.equal(r.calls[0].data.updatedAt, at);
  r = recorder("savedReport");
  await new PrismaSavedReportRepository(r.prisma).update({ id: "r", tenantId, scope: "MINE", projectId: "p", ownerId: "u", name: "n", query: {}, createdAt: at, updatedAt: at }, new Date(0));
  assert.equal(r.calls[0].data.updatedAt, at);
});
