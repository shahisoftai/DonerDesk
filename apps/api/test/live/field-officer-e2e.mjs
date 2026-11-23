/**
 * End-to-end check of a field officer against a running API (Phase 63c). Makes a scratch project, one facility, one small published
 * form and a test field officer, then acts as that person: what they need must work (the offline download holds only their own places,
 * a draft, a photo and a record are saved, the facility is marked done) and what they must not reach must be refused. Cleans up: the
 * project is archived, the facility retired, the test user deleted. Leaves the facility's record as test data inside the archived project.
 *
 *   DD_API=http://127.0.0.1:14001 DD_ADMIN_EMAIL=… DD_ADMIN_PASS=… [EXPECT_MODE=enforce|audit] node apps/api/test/live/field-officer-e2e.mjs
 *
 * KEEP=1 skips the clean-up and prints a SANDBOX line (a scratch project, a facility, a form and a field officer to sign in as, for a
 * browser check); TEARDOWN='<that json>' removes it. Credentials come from the environment only. The API is the host's 127.0.0.1:4001 (an SSH tunnel). In `audit` mode a closed route
 * is let through and logged (so closed checks only warn); in `enforce` mode it must answer 403.
 */
const API = process.env.DD_API ?? "http://127.0.0.1:14001";
const MODE = process.env.EXPECT_MODE ?? "enforce";
const stamp = Date.now().toString(36);
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `  (${detail})` : ""}`); };
const warn = (name, detail = "") => console.log(`warn ${name}${detail ? `  (${detail})` : ""}`);

async function call(token, method, path, body, form) {
  const res = await fetch(API + path, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}) }, body: form ?? (body ? JSON.stringify(body) : undefined) });
  let json = null; try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

async function teardown(admin, t) {
  if (t.userId) await call(admin, "POST", `/v1/users/${t.userId}/status`, { action: "DELETE" });
  if (t.projectId) await call(admin, "POST", `/v1/projects/${t.projectId}/archive`);
  if (t.placeId) await call(admin, "POST", `/v1/places/${t.placeId}/archive`);
}

if (!process.env.DD_ADMIN_EMAIL || !process.env.DD_ADMIN_PASS) { console.error("Set DD_ADMIN_EMAIL and DD_ADMIN_PASS."); process.exit(2); }
const admin = (await call(null, "POST", "/v1/auth/login", { email: process.env.DD_ADMIN_EMAIL, password: process.env.DD_ADMIN_PASS })).json.token;
if (process.env.TEARDOWN) { await teardown(admin, JSON.parse(process.env.TEARDOWN)); console.log("sandbox removed"); process.exit(0); }
let projectId, placeId, formId, userId, sandbox;
try {
  const today = new Date(); const end = new Date(today.getTime() + 7 * 864e5);
  projectId = (await call(admin, "POST", "/v1/projects", { title: `ZZ TEST field officer e2e ${stamp}`, projectCode: `ZZ-FO-${stamp}`.toUpperCase(), donorName: "Test", implementingOrganization: "Test", country: "Pakistan", sector: "HEALTH", startDate: today.toISOString(), endDate: end.toISOString(), reportingFrequency: "FINAL" })).json.id;
  placeId = (await call(admin, "POST", "/v1/places", { name: `ZZ E2E Facility ${stamp}`, kind: "POINT", adminLevel: 4, facility: true })).json?.id;
  check("scratch project and facility created", Boolean(projectId && placeId));
  formId = (await call(admin, "POST", "/v1/collection-forms", { projectId, name: "ZZ e2e form", subject: "FACILITY", mappings: [], fields: [
    { key: "q_name", label: "Name of the in-charge", type: "TEXT", required: true }, { key: "q_photo", label: "Photo of the gate", type: "FILE" }] })).json?.id;
  await call(admin, "POST", `/v1/collection-forms/${formId}/publish`);
  const invite = (await call(admin, "POST", "/v1/users/invite", { email: `zz-fo-e2e-${stamp}@example.org`, role: "FIELD_OFFICER", projectIds: [projectId] })).json;
  const password = `Zz-${stamp}-Field-Test!9`;
  const accepted = (await call(null, "POST", "/v1/invitations/accept", { token: invite.token, name: "ZZ Field Test", password })).json;
  const fo = accepted.token; userId = accepted.userId;
  sandbox = { email: `zz-fo-e2e-${stamp}@example.org`, password, projectId, formId, placeId, userId };
  check("test field officer joined", Boolean(fo && accepted.role === "FIELD_OFFICER"));
  // The invitation page records the Terms acceptance itself; without it a signed-in browser is sent to onboarding.
  await call(fo, "POST", "/v1/legal/consent", { accepted: true, source: "invitation" });
  const assigned = await call(admin, "POST", `/v1/collection-forms/${formId}/assignments`, { assignments: [{ placeId, assigneeId: userId }] });
  check("facility given to the field officer", assigned.status === 200 || assigned.status === 201);

  // What their own screens need.
  const get = async (path) => call(fo, "GET", path);
  check("sees the project list with only their project", (await get("/v1/projects")).json?.items?.length === 1);
  check("opens the project", (await get(`/v1/projects/${projectId}`)).status === 200);
  check("sees the form", (await get(`/v1/collection-forms/${formId}`)).status === 200);
  const mine = (await get("/v1/me/facility-assignments")).json?.assignments ?? [];
  check("their facility is listed as to do", mine.length === 1 && mine[0].status === "TO_DO");
  const pack = (await get(`/v1/projects/${projectId}/offline-pack`)).json;
  const packIds = (pack?.places ?? []).map((p) => p.id);
  check("the offline download holds their facility", packIds.includes(placeId));
  const orgPlaces = (await call(admin, "GET", "/v1/places")).json?.places ?? [];
  check("the offline download is smaller than the organisation's whole list", orgPlaces.length > packIds.length && packIds.length <= 3, `${packIds.length} of ${orgPlaces.length}`);
  const draft = await call(fo, "PUT", `/v1/collection-forms/${formId}/draft?placeId=${encodeURIComponent(placeId)}`, { answers: { q_name: "Dr Test" }, startedAt: new Date().toISOString() });
  check("a draft is saved", draft.status === 200 || draft.status === 201, String(draft.status));
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const fd = new FormData(); fd.append("file", new Blob([png], { type: "image/png" }), "gate.png");
  const up = await call(fo, "POST", `/v1/collection-forms/${formId}/files`, null, fd);
  check("a photo is uploaded", up.status === 201 || up.status === 200, String(up.status));
  const sent = await call(fo, "POST", `/v1/collection-forms/${formId}/records`, { id: `e2e-${stamp}-record-0001`, placeId, answers: { q_name: "Dr Test", q_photo: up.json?.id }, startedAt: new Date().toISOString() });
  check("the record is sent", sent.status === 201 || sent.status === 200, `${sent.status} ${sent.json?.title ?? ""}`);
  const after = (await get("/v1/me/facility-assignments")).json?.assignments ?? [];
  check("the facility is marked done", after.every((a) => a.status !== "TO_DO"));

  // What they must not reach.
  const closed = [
    ["GET", `/v1/projects/${projectId}/finance`], ["GET", `/v1/projects/${projectId}/budget`], ["GET", "/v1/funding"], ["GET", "/v1/billing/summary"],
    ["GET", `/v1/projects/${projectId}/data-sheet`], ["GET", `/v1/projects/${projectId}/management-report`], ["POST", "/v1/evidence/search"],
    ["GET", "/v1/canvases"], ["POST", "/v1/visual-data/query"], ["GET", `/v1/collection-forms/${formId}/totals`], ["GET", "/v1/users"], ["GET", "/v1/where-we-work"],
  ];
  for (const [m, p] of closed) {
    const r = await call(fo, m, p, m === "POST" ? {} : undefined);
    const refused = r.status === 403 || r.status === 404;
    if (MODE === "enforce") check(`refused: ${m} ${p.replace(projectId, ":p").replace(formId, ":f")}`, refused, String(r.status));
    else if (!refused) warn(`audit mode lets through: ${m} ${p.replace(projectId, ":p").replace(formId, ":f")}`, String(r.status));
  }
} finally {
  if (process.env.KEEP === "1" && sandbox) console.log(`SANDBOX ${JSON.stringify(sandbox)}`);
  else await teardown(admin, { userId, projectId, placeId }); // clean up, whatever happened
}
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} of ${results.length} checks failed` : `\nAll ${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
