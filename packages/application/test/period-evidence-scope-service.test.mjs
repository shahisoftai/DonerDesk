import assert from "node:assert/strict";
import test from "node:test";
import { PeriodEvidenceScope } from "../dist/index.js";

/** A repository that really pages, so the service is checked against more than one page. */
function pagedRepo(files) {
  return {
    async search(f) {
      const matching = files.filter((x) => (!f.projectId || x.projectId === f.projectId) && (!f.verificationStatus || x.verificationStatus === f.verificationStatus));
      const size = f.pageSize ?? 20;
      const page = f.page ?? 1;
      return { ok: true, value: { items: matching.slice((page - 1) * size, page * size), total: matching.length, page, pageSize: size } };
    },
  };
}
const mk = (n, extra = {}) => Array.from({ length: n }, (_, i) => ({ id: `e${i}`, projectId: "pr", verificationStatus: "VERIFIED", reportingPeriodId: "p1", ...extra }));

test("reads every page (no silent 200-file cap)", async () => {
  const svc = new PeriodEvidenceScope(pagedRepo(mk(450)));
  const r = await svc.filesFor("t", { id: "p1", projectId: "pr", reportType: "MONTHLY" }, []);
  assert.equal(r.value.length, 450);
});

test("verifiedOnly drops unverified files", async () => {
  const files = [...mk(2), { id: "x", projectId: "pr", verificationStatus: "UPLOADED", reportingPeriodId: "p1" }];
  const svc = new PeriodEvidenceScope(pagedRepo(files));
  const all = await svc.filesFor("t", { id: "p1", projectId: "pr", reportType: "MONTHLY" }, []);
  const verified = await svc.filesFor("t", { id: "p1", projectId: "pr", reportType: "MONTHLY" }, [], { verifiedOnly: true });
  assert.equal(all.value.length, 3);
  assert.equal(verified.value.length, 2);
});

test("a roll-up period gets the whole project, a monthly one only its own", async () => {
  const files = mk(3, { reportingPeriodId: "other" });
  const svc = new PeriodEvidenceScope(pagedRepo(files));
  assert.equal((await svc.filesFor("t", { id: "p1", projectId: "pr", reportType: "MONTHLY" }, [])).value.length, 0);
  assert.equal((await svc.filesFor("t", { id: "p1", projectId: "pr", reportType: "FINAL" }, [])).value.length, 3);
});

test("a repository error is returned, not swallowed", async () => {
  const svc = new PeriodEvidenceScope({ search: async () => ({ ok: false, error: new Error("boom") }) });
  const r = await svc.filesFor("t", { id: "p1", projectId: "pr", reportType: "MONTHLY" }, []);
  assert.equal(r.ok, false);
});
