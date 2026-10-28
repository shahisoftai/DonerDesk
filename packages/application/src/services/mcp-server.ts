import type { ApiScope } from "@donordesk/domain";

/**
 * A Model Context Protocol server over the read-only public API (Phase 33.7): the same keys, scopes and project limits, offered as
 * tools an AI assistant can call. This is the protocol only (JSON-RPC 2.0, the "tools" part of MCP): which tools exist, who may see
 * them, how a request is answered. The host (the API route) runs the tool and re-checks the key against the project every time.
 */
export const MCP_PROTOCOL_VERSION = "2025-03-26";
export const MCP_MAX_BATCH = 20;
export const MCP_MAX_TEXT = 120_000;

export interface McpTool {
  name: string;
  description: string;
  scope: ApiScope;
  /** True when the tool names a project (the key must be allowed that project). */
  needsProject: boolean;
  inputSchema: Record<string, unknown>;
}

export const MCP_TOOLS: ReadonlyArray<McpTool> = [
  {
    name: "list_projects", scope: "projects:read", needsProject: false,
    description: "List the projects this key may read: id, code, title, donor, country, sector, status and dates.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_indicator_values", scope: "indicators:read", needsProject: true,
    description: "Indicator definitions (code, name, unit, baseline, target), reporting periods, and every recorded value with its verification status, for one project. A missing value is absent, never zero. Finance is not included.",
    inputSchema: { type: "object", properties: { projectId: { type: "string", description: "A project id from list_projects" } }, required: ["projectId"], additionalProperties: false },
  },
  {
    name: "get_results_by_place", scope: "places:read", needsProject: true,
    description: "Indicator results rolled up by place for one project, at an administrative level (0 country, 1 region, 2 district, 3 sub-district, 4 site). Rates are shown for the place that recorded them and never added up.",
    inputSchema: { type: "object", properties: { projectId: { type: "string" }, level: { type: "integer", minimum: 0, maximum: 4, description: "Default 1" } }, required: ["projectId"], additionalProperties: false },
  },
];

export type ToolOutcome = { ok: true; data: unknown } | { ok: false; message: string };

export interface McpHost {
  /** What the key may use. */
  scopes: readonly ApiScope[];
  /** Runs one allowed tool. The host checks the key against the project named in `args`. */
  call(tool: McpTool, args: Record<string, unknown>): Promise<ToolOutcome>;
}

type Id = string | number | null;
export type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: Id; result: unknown }
  | { jsonrpc: "2.0"; id: Id; error: { code: number; message: string } };

const rpcError = (id: Id, code: number, message: string): JsonRpcResponse => ({ jsonrpc: "2.0", id, error: { code, message } });
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** The tools a key can see: only those its scopes allow. */
export const toolsFor = (scopes: readonly ApiScope[]): McpTool[] => MCP_TOOLS.filter((t) => scopes.includes(t.scope));

function textResult(text: string, isError: boolean) {
  const clipped = text.length > MCP_MAX_TEXT ? `${text.slice(0, MCP_MAX_TEXT)}\n[The answer was cut here because it is long. Ask for one project or one level at a time.]` : text;
  return { content: [{ type: "text", text: clipped }], isError };
}

/** Answers one JSON-RPC message; `null` for a notification (nothing is sent back). */
export async function handleMcpMessage(message: unknown, host: McpHost): Promise<JsonRpcResponse | null> {
  if (!isRecord(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string") return rpcError(null, -32600, "Invalid request");
  const hasId = "id" in message;
  const id = (hasId && (typeof message.id === "string" || typeof message.id === "number") ? message.id : null) as Id;
  if (!hasId) return null; // a notification, such as "initialized"
  const params = isRecord(message.params) ? message.params : {};

  switch (message.method) {
    case "initialize":
      return {
        jsonrpc: "2.0", id,
        result: {
          protocolVersion: MCP_PROTOCOL_VERSION, capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "DonorDesk", version: "1" },
          instructions: "Read-only access to a humanitarian organisation's projects, indicator values and results by place. Start with list_projects. Values marked not verified are drafts. A missing value means nothing was recorded, not zero.",
        },
      };
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools: toolsFor(host.scopes).map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) } };
    case "tools/call": {
      const name = typeof params.name === "string" ? params.name : "";
      const tool = MCP_TOOLS.find((t) => t.name === name);
      if (!tool) return rpcError(id, -32602, `Unknown tool: ${name || "(none)"}`);
      const args = isRecord(params.arguments) ? params.arguments : {};
      // A key that may not use a tool does not learn more than that: the tool is reported as not allowed.
      if (!host.scopes.includes(tool.scope)) return { jsonrpc: "2.0", id, result: textResult("This key may not use that tool.", true) };
      if (tool.needsProject && (typeof args.projectId !== "string" || args.projectId.trim() === "")) return { jsonrpc: "2.0", id, result: textResult("Give a projectId (see list_projects).", true) };
      try {
        const outcome = await host.call(tool, args);
        return { jsonrpc: "2.0", id, result: outcome.ok ? textResult(JSON.stringify(outcome.data), false) : textResult(outcome.message, true) };
      } catch {
        return { jsonrpc: "2.0", id, result: textResult("That could not be answered right now.", true) };
      }
    }
    default:
      return rpcError(id, -32601, "Method not found");
  }
}

/** One message or a batch (at most MCP_MAX_BATCH). Returns what to send back, or `null` when there is nothing to send. */
export async function handleMcpPayload(payload: unknown, host: McpHost): Promise<JsonRpcResponse | JsonRpcResponse[] | null> {
  if (Array.isArray(payload)) {
    if (payload.length === 0 || payload.length > MCP_MAX_BATCH) return rpcError(null, -32600, `A batch holds 1 to ${MCP_MAX_BATCH} messages`);
    const answers = (await Promise.all(payload.map((m) => handleMcpMessage(m, host)))).filter((a): a is JsonRpcResponse => a !== null);
    return answers.length > 0 ? answers : null;
  }
  return handleMcpMessage(payload, host);
}
