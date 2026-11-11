import test from "node:test";
import assert from "node:assert/strict";
import { ownPlaces, CountFactsService } from "../dist/index.js";
import { TenantId } from "@donordesk/domain";

test("a link lists only the places this project uses and the areas above them", () => {
  const tree = [
    { key: "nepal", label: "Nepal", level: 0, parentKey: null }, { key: "karnali", label: "Karnali", level: 1, parentKey: "nepal" }, { key: "humla", label: "Humla", level: 2, parentKey: "karnali" },
    { key: "kenya", label: "Kenya", level: 0, parentKey: null }, { key: "turkana", label: "Turkana County", level: 1, parentKey: "kenya" },
  ];
  assert.deepEqual(ownPlaces(tree, [{ key: "humla" }]).map((p) => p.key).sort(), ["humla", "karnali", "nepal"]);
  assert.deepEqual(ownPlaces(tree, []), [], "no records, no places");
});

test("through a link the counts carry donors and partners as numbers; their names are never in the facts' shape the page shows", async () => {
  const tenant = TenantId.create("tenant-1");
  const places = { list: async () => ({ ok: true, value: [] }) };
  const projects = { findById: async () => ({ ok: true, value: { donorName: "UNICEF", partnerOrganization: "Karnali Nutrition Alliance" } }) };
  const gate = { finance: async () => undefined }; // a guest has no finance: the funding names are still counted for a link
  const funding = { listForProjects: async () => ({ ok: true, value: [{ fundingSourceId: "s1" }, { fundingSourceId: "s2" }] }) };
  const sources = { list: async () => ({ ok: true, value: [{ id: "s1", name: "European Union" }, { id: "s2", name: "USAID" }] }) };
  const svc = new CountFactsService(places, projects, gate, funding, sources);
  const ctx = { tenant: { tenantId: tenant, userId: "share-link", role: "VIEWER" }, requestId: "r" };
  const viaLink = await svc.read(ctx, ["p1"], [], { shareLink: true });
  assert.equal(viaLink.donors.length, 3, "UNICEF, European Union and USAID are counted");
  assert.equal(viaLink.partners.length, 1);
  const signedOutGuestNoGate = await svc.read(ctx, ["p1"], []);
  assert.equal(signedOutGuestNoGate.donors.length, 1, "without a link the finance gate still decides which funding names are read");
});
