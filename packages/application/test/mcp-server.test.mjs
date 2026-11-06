import test from "node:test";
import assert from "node:assert/strict";
import { handleMcpMessage, handleMcpPayload, toolsFor, MCP_TOOLS, MCP_PROTOCOL_VERSION } from "../dist/index.js";

const host = (scopes, calls = []) => ({ scopes, call: async (tool, args) => (calls.push([tool.name, args]), tool.name === "boom" ? { ok: false, message: "x" } : { ok: true, data: { tool: tool.name, args } }) });
const rpc = (method, params, id = 1) => ({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) });

test("the handshake names the protocol and offers tools; a notification gets no answer", async () => {
  const init = await handleMcpMessage(rpc("initialize", { protocolVersion: "2025-03-26" }), host(["projects:read"]));
  assert.equal(init.result.protocolVersion, MCP_PROTOCOL_VERSION);
  assert.deepEqual(init.result.capabilities, { tools: { listChanged: false } });
  assert.match(init.result.instructions, /not zero/);
  assert.equal(await handleMcpMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, host([])), null);
  assert.deepEqual((await handleMcpMessage(rpc("ping"), host([]))).result, {});
});

test("a key sees only the tools its scopes allow", async () => {
  const names = async (scopes) => (await handleMcpMessage(rpc("tools/list"), host(scopes))).result.tools.map((t) => t.name);
  assert.deepEqual(await names(["projects:read"]), ["list_projects"]);
  assert.deepEqual(await names(["projects:read", "indicators:read", "places:read"]), MCP_TOOLS.map((t) => t.name));
  assert.deepEqual(await names([]), []);
  assert.ok(toolsFor(["places:read"]).every((t) => t.inputSchema.type === "object"));
});

test("a tool call runs the tool; one the key may not use, or without a project, is refused and nothing runs", async () => {
  const calls = [];
  const h = host(["projects:read", "indicators:read"], calls);
  const ok = await handleMcpMessage(rpc("tools/call", { name: "get_indicator_values", arguments: { projectId: "p1" } }), h);
  assert.equal(ok.result.isError, false);
  assert.deepEqual(JSON.parse(ok.result.content[0].text), { tool: "get_indicator_values", args: { projectId: "p1" } });
  const denied = await handleMcpMessage(rpc("tools/call", { name: "get_results_by_place", arguments: { projectId: "p1" } }), h);
  assert.equal(denied.result.isError, true);
  assert.match(denied.result.content[0].text, /may not use/);
  const noProject = await handleMcpMessage(rpc("tools/call", { name: "get_indicator_values", arguments: {} }), h);
  assert.match(noProject.result.content[0].text, /projectId/);
  assert.equal((await handleMcpMessage(rpc("tools/call", { name: "nope" }), h)).error.code, -32602);
  assert.deepEqual(calls.map((c) => c[0]), ["get_indicator_values"], "only the allowed call reached the host");
});

test("a failing tool or host never leaks detail; unknown methods and malformed messages are errors", async () => {
  const throwing = { scopes: ["projects:read"], call: async () => { throw new Error("secret stack"); } };
  const r = await handleMcpMessage(rpc("tools/call", { name: "list_projects" }), throwing);
  assert.equal(r.result.isError, true);
  assert.ok(!JSON.stringify(r).includes("secret stack"));
  assert.equal((await handleMcpMessage(rpc("resources/list"), host([]))).error.code, -32601);
  assert.equal((await handleMcpMessage({ nope: 1 }, host([]))).error.code, -32600);
  assert.equal((await handleMcpMessage("text", host([]))).error.code, -32600);
});

test("a long answer is cut with a note rather than sent whole", async () => {
  const big = { scopes: ["projects:read"], call: async () => ({ ok: true, data: { rows: "x".repeat(300_000) } }) };
  const r = await handleMcpMessage(rpc("tools/call", { name: "list_projects" }), big);
  assert.ok(r.result.content[0].text.length < 125_000);
  assert.match(r.result.content[0].text, /cut here/);
});

test("a batch is answered in one go (notifications left out) and is limited", async () => {
  const h = host(["projects:read"]);
  const out = await handleMcpPayload([rpc("ping", undefined, 1), { jsonrpc: "2.0", method: "notifications/initialized" }, rpc("tools/list", undefined, 2)], h);
  assert.deepEqual(out.map((o) => o.id), [1, 2]);
  assert.equal(await handleMcpPayload([{ jsonrpc: "2.0", method: "notifications/initialized" }], h), null);
  assert.equal((await handleMcpPayload([], h)).error.code, -32600);
  assert.equal((await handleMcpPayload(Array.from({ length: 21 }, (_, i) => rpc("ping", undefined, i)), h)).error.code, -32600);
});
