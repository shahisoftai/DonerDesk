import { randomUUID } from "node:crypto";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import type { Stats } from "node:fs";
import { promises as fs } from "node:fs";

const execFile = promisify(execFileCb);

/**
 * RuntimeProvisioner — write the SaaS control-plane LLM configuration into
 * the Contabo runtime env files (`/opt/donordesk/shared/api.env` and
 * `/opt/donordesk/shared/workers.env`) so that selecting a provider in the
 * SuperAdmin portal actually makes the AI Reporter available on
 * `donordesk.online`.
 *
 * Security:
 *  - The secret value is written ONLY into the workers.env file via an
 *    atomic temp-file write. It is never logged, never echoed to stdout/stderr,
 *    never placed on the process command line (restart is via execFile with
 *    args, never shell), and never sent to the audit table (the audit row
 *    records `[PROVISIONED]` in place of the secret).
 *  - The env file is written atomically (temp + rename) and chowned to
 *    donordesk:donordesk mode 0640 so only root (systemd reading the file)
 *    and the donordesk service user can read it; the donordesk service user
 *    can also write to it.
 *  - Restart is performed via `sudo /usr/bin/systemctl restart ...` under a
 *    tightly scoped NOPASSWD sudoers entry (`donordesk` may restart only
 *    `donordesk-api` and `donordesk-workers`). No shell, no other commands.
 */

export const MANAGED_BLOCK_MARKER = "# dd-managed:LLM";
export const MANAGED_BLOCK_END_MARKER = "# dd-end-managed:LLM";

const DEFAULT_API_ENV_PATH = "/opt/donordesk/shared/api.env";
const DEFAULT_WORKERS_ENV_PATH = "/opt/donordesk/shared/workers.env";
const ENV_FILE_MODE = 0o640;

export interface ProvisionTarget {
  apiEnvPath?: string;
  workersEnvPath?: string;
}

export interface GlobalLlmConfig {
  provider: string;
  model: string;
  baseUrl?: string;
  apiKey: string;
}

export interface ProvisionAudit {
  actor: { sub: string; email: string };
  ip?: string;
  userAgent?: string;
}

export interface ProvisionResult {
  apiEnvChanged: boolean;
  workersEnvChanged: boolean;
  restarted: boolean;
}

export interface RestartResult {
  ok: boolean;
  stderr?: string;
}

/** Injected for tests; defaults to real node:fs and node:child_process. */
export interface RuntimeProvisionerDeps {
  fs?: typeof fs;
  execFile?: (file: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;
  log?: (line: string) => void;
}

/**
 * Render the managed env block (lines between marker and end-marker) for the
 * workers.env file. Contains the AI provider credentials and the worker-side
 * timeout/contract configuration.
 */
export function renderWorkersManagedBlock(config: GlobalLlmConfig, scopeId: string): string[] {
  const header = `${MANAGED_BLOCK_MARKER}:GLOBAL:${config.provider}:${scopeId}`;
  const lines: string[] = [header];
  lines.push(`AI_REPORTER_PROVIDER=${config.provider}`);
  lines.push(`AI_REPORTER_MODEL=${config.model}`);
  if (config.baseUrl && config.baseUrl.trim().length > 0) {
    lines.push(`AI_REPORTER_BASE_URL=${config.baseUrl.trim().replace(/\/+$/, "")}`);
  }
  lines.push(`AI_REPORTER_API_KEY=${config.apiKey}`);
  lines.push(`AI_REPORTER_TIMEOUT=180`);
  // Report-quality v4: 90s per LLM call (45s timed out healthy MiniMax
  // sections), 200s per section (draft + one validator-feedback retry).
  lines.push(`AI_REPORTER_DRAFT_TIMEOUT_MS=90000`);
  lines.push(`AI_REPORTER_TOTAL_DRAFT_TIMEOUT_MS=200000`);
  lines.push(`AI_REPORTER_CONTRACT_VERSION=5`);
  lines.push(MANAGED_BLOCK_END_MARKER);
  return lines;
}

/**
 * Operator-tunable AI Reporter keys that must survive a re-provision: the
 * managed block re-renders catalog defaults, so any current value found in
 * the existing env file is carried forward (last occurrence wins).
 */
const WORKERS_PRESERVED_KEYS = [
  "AI_REPORTER_DRAFT_TIMEOUT_MS",
  "AI_REPORTER_TOTAL_DRAFT_TIMEOUT_MS",
  "AI_REPORTER_MAX_TOKENS",
] as const;

export function parseEnvValues(content: string, keys: readonly string[]): Record<string, string> {
  const found: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq);
    if (keys.includes(key)) found[key] = trimmed.slice(eq + 1);
  }
  return found;
}

/**
 * Operator-tunable api.env keys that must survive a re-provision, mirroring
 * WORKERS_PRESERVED_KEYS. `AI_REPORTER_DRAFT_TIMEOUT_MS` here is the ceiling
 * `AiReporterWorkerClient` applies to the ENTIRE section pipeline call
 * (draft -> critique -> refine, up to ~3-4 sequential LLM round-trips), not a
 * single LLM call — it must stay comfortably above the worker's own
 * per-call `AI_REPORTER_TIMEOUT` (workers.env), or every real generation
 * aborts client-side before the worker can even respond.
 */
const API_PRESERVED_KEYS = ["AI_REPORTER_DRAFT_TIMEOUT_MS", "AI_REPORTER_HTTP_TIMEOUT_MS"] as const;

/**
 * Render the api.env managed block. The api needs the feature flag and the
 * reporter URL; it also benefits from LLM_PROVIDER so the standard LLM fallback
 * path can resolve. No secret is written here — the api calls the worker.
 *
 * `AI_REPORTER_DRAFT_TIMEOUT_MS` is written here (catalog default 180000ms)
 * so it is never silently unset: previously only `workers.env` carried this
 * key, so `AiReporterWorkerClient` always fell back to its 45s hardcoded
 * default regardless of what was configured, aborting every real
 * (non-trivial) generation before the provider could respond.
 */
export function renderApiManagedBlock(config: { provider: string; model: string }, scopeId: string): string[] {
  const header = `${MANAGED_BLOCK_MARKER}:GLOBAL:${config.provider}:${scopeId}`;
  const lines: string[] = [header];
  lines.push(`AI_REPORTER_ENABLED=1`);
  lines.push(`AI_REPORTER_URL=http://127.0.0.1:8092`);
  lines.push(`AI_REPORTER_PROVIDER=${config.provider}`);
  lines.push(`AI_REPORTER_MODEL=${config.model}`);
  lines.push(`LLM_PROVIDER=${config.provider}`);
  lines.push(`AI_REPORTER_DRAFT_TIMEOUT_MS=180000`);
  // The api's HTTP ceiling for one worker section call. Explicit, because the
  // api-side DRAFT value above predates v4 and means "whole call"; the client
  // prefers AI_REPORTER_HTTP_TIMEOUT_MS. Must exceed the worker's
  // AI_REPORTER_TOTAL_DRAFT_TIMEOUT_MS (200000).
  lines.push(`AI_REPORTER_HTTP_TIMEOUT_MS=240000`);
  lines.push(`AI_REPORTER_CONTRACT_VERSION=5`);
  lines.push(MANAGED_BLOCK_END_MARKER);
  return lines;
}

/**
 * Remove any top-level (non-managed-block) declaration of a key the managed
 * block is about to own. Environment files historically accumulated
 * standalone `KEY=value` lines (e.g. `AI_REPORTER_ENABLED`/`AI_REPORTER_URL`
 * added by hand before the provisioning system existed) that then duplicated
 * the managed block's own declaration of the same key. Duplicate keys have
 * caused `systemd`'s `EnvironmentFile` loader to silently drop later
 * variables in the file in production — this removes the root cause instead
 * of relying on "last occurrence wins" semantics that are not guaranteed by
 * every env-file consumer.
 */
export function stripStandaloneManagedKeys(content: string, keys: readonly string[]): { content: string; changed: boolean } {
  const blockRegex = new RegExp(`${escapeRegex(MANAGED_BLOCK_MARKER)}:GLOBAL:[^\\n]*\\n(?:[^\\n]*\\n)*?${escapeRegex(MANAGED_BLOCK_END_MARKER)}\\n?`, "m");
  const blockMatch = content.match(blockRegex);
  const blockStart = blockMatch ? content.indexOf(blockMatch[0]) : -1;
  const blockEnd = blockMatch ? blockStart + blockMatch[0].length : -1;
  let offset = 0;
  let changed = false;
  const lines = content.split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    const lineStart = offset;
    offset += line.length + 1;
    const insideBlock = blockStart >= 0 && lineStart >= blockStart && lineStart < blockEnd;
    const trimmed = line.trim();
    const eq = trimmed.indexOf("=");
    const key = eq > 0 ? trimmed.slice(0, eq) : "";
    if (!insideBlock && !trimmed.startsWith("#") && keys.includes(key)) {
      changed = true;
      continue;
    }
    kept.push(line);
  }
  return { content: kept.join("\n"), changed };
}

/**
 * Replace (or insert) the managed block for the given (provider, scopeId) in
 * the env file content. Idempotent: if the file already contains the same
 * block, the content is returned unchanged (changed = false).
 */
export function applyManagedBlockToEnv(content: string, newBlock: string[]): { content: string; changed: boolean } {
  const newContent = newBlock.join("\n");
  const existingBlockRegex = new RegExp(
    `${escapeRegex(MANAGED_BLOCK_MARKER)}:GLOBAL:[^\\s]+:[^\\n]*\\n(?:[^\\n]*\\n)*?${escapeRegex(MANAGED_BLOCK_END_MARKER)}\\n?`,
    "m",
  );
  const existing = content.match(existingBlockRegex);
  // Normalise trailing whitespace/newlines so a re-apply of an identical block
  // is correctly identified as a no-op even when the regex capture happens to
  // include an optional trailing newline that the freshly-rendered block does
  // not.
  const normalise = (value: string) => value.replace(/\s+$/, "");
  let next = content;
  if (existing) {
    if (normalise(existing[0]) === normalise(newContent)) return { content, changed: false };
    next = content.replace(existingBlockRegex, newContent);
  } else {
    const sep = content.length > 0 && !content.endsWith("\n") ? "\n" : "";
    next = `${content}${sep}${newContent}`;
  }
  return { content: next, changed: true };
}

export function removeManagedBlockFromEnv(content: string, provider: string, scopeId: string): { content: string; changed: boolean } {
  const headerPrefix = `${MANAGED_BLOCK_MARKER}:GLOBAL:${provider}:${scopeId}`;
  const startIdx = content.indexOf(headerPrefix);
  if (startIdx === -1) return { content, changed: false };
  const blockStart = startIdx > 0 && content[startIdx - 1] === "\n" ? startIdx - 1 : startIdx;
  const endMarker = content.indexOf(MANAGED_BLOCK_END_MARKER, startIdx);
  if (endMarker === -1) return { content, changed: false };
  const endIdx = content.indexOf("\n", endMarker);
  const blockEnd = endIdx === -1 ? content.length : endIdx + 1;
  return { content: content.slice(0, blockStart) + content.slice(blockEnd), changed: true };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Atomically write the env file with the desired mode and ownership. */
async function atomicWriteEnvFile(path: string, content: string, fsImpl: typeof fs): Promise<void> {
  const dir = path.slice(0, path.lastIndexOf("/"));
  const filename = path.slice(path.lastIndexOf("/") + 1);
  const tempPath = `${dir}/.${filename}.${randomUUID()}.tmp`;
  let owner: { uid: number; gid: number } | null = null;
  try {
    const s: Stats = await fsImpl.stat(path);
    owner = { uid: s.uid, gid: s.gid };
  } catch {
    owner = null;
  }
  // A file with no trailing newline has been observed in production to make
  // systemd's EnvironmentFile loader silently drop the last one or two
  // KEY=VALUE lines (the ones immediately before the truncated final line),
  // with no error logged anywhere — this was the root cause of two separate
  // "provider config silently missing from the live process" incidents.
  // applyManagedBlockToEnv/renderApiManagedBlock never guaranteed a trailing
  // newline (`Array.join("\n")` never adds a final one), so every write path
  // must add it here as the last line of defence.
  const normalized = content.endsWith("\n") ? content : `${content}\n`;
  await fsImpl.writeFile(tempPath, normalized, { mode: 0o600 });
  await fsImpl.chmod(tempPath, ENV_FILE_MODE);
  if (owner) {
    await fsImpl.chown(tempPath, owner.uid as unknown as number, owner.gid as unknown as number);
  } else {
    const userInfo = await readUidGid("donordesk", fsImpl);
    if (userInfo) await fsImpl.chown(tempPath, userInfo.uid as unknown as number, userInfo.gid as unknown as number);
  }
  await fsImpl.rename(tempPath, path);
}

async function readUidGid(user: string, fsImpl: typeof fs): Promise<{ uid: number; gid: number } | null> {
  try {
    const { execFile: exec } = await import("node:child_process");
    const { promisify: prom } = await import("node:util");
    const execFileAsync = prom(exec);
    const result = (await execFileAsync("id", [user])) as { stdout: string };
    const m = /uid=(\d+).*gid=(\d+)/.exec(result.stdout);
    if (!m) return null;
    return { uid: Number(m[1]), gid: Number(m[2]) };
  } catch {
    return null;
  }
}

/** Restart the api and workers so the new env takes effect. Scoped sudoers. */
async function restartServices(
  exec: (file: string, args: string[]) => Promise<{ stdout: string; stderr: string }>,
  log: (line: string) => void,
): Promise<RestartResult> {
  const commands: Array<[string, string[]]> = [
    ["/usr/bin/sudo", ["/usr/bin/systemctl", "restart", "donordesk-api"]],
    ["/usr/bin/sudo", ["/usr/bin/systemctl", "restart", "donordesk-workers"]],
  ];
  for (const [file, args] of commands) {
    try {
      const result = await exec(file, args);
      log(`restart ok: ${args.join(" ")}${result.stderr ? ` (${result.stderr.trim()})` : ""}`);
    } catch (error) {
      const stderr =
        error instanceof Error && "stderr" in error ? String((error as { stderr: unknown }).stderr) : error instanceof Error ? error.message : String(error);
      log(`restart failed: ${args.join(" ")}: ${stderr}`);
      return { ok: false, stderr };
    }
  }
  return { ok: true };
}

export class RuntimeProvisioner {
  private readonly fsImpl: typeof fs;
  private readonly execFileFn: (file: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;
  private readonly log: (line: string) => void;

  constructor(deps: RuntimeProvisionerDeps = {}) {
    this.fsImpl = deps.fs ?? fs;
    this.execFileFn = deps.execFile ?? execFile;
    this.log = deps.log ?? (() => undefined);
  }

  /**
   * Provision a GLOBAL enabled LLM configuration into both env files and
   * restart the api/workers. The caller passes the decrypted secret as a
   * parameter; this method never persists the secret outside the env file
   * and never logs it.
   */
  async provisionGlobalLlm(
    config: GlobalLlmConfig,
    target: ProvisionTarget = {},
    _audit: ProvisionAudit,
  ): Promise<ProvisionResult> {
    const apiEnvPath = target.apiEnvPath ?? DEFAULT_API_ENV_PATH;
    const workersEnvPath = target.workersEnvPath ?? DEFAULT_WORKERS_ENV_PATH;
    const scopeId = "GLOBAL";

    // Preserve operator-tuned values across re-provisions before stripping
    // standalone duplicates, so a value an operator hand-tuned outside the
    // managed block (rare, but not silently discarded) survives the dedup.
    const apiOriginal0 = await this.readFile(apiEnvPath);
    const apiPreserved = parseEnvValues(apiOriginal0, API_PRESERVED_KEYS);
    const apiBlock = renderApiManagedBlock(config, scopeId);
    for (const key of API_PRESERVED_KEYS) {
      const value = apiPreserved[key];
      if (value === undefined) continue;
      const idx = apiBlock.findIndex((l) => l.startsWith(`${key}=`));
      if (idx >= 0) apiBlock[idx] = `${key}=${value}`;
    }

    // Dedup: remove any standalone (pre-provisioning-era) declaration of a
    // key the managed block now owns, for BOTH files, before applying the
    // block. Duplicate keys across a file have been observed to make
    // systemd's EnvironmentFile loader silently drop later variables in
    // production (see runtime-provisioner.ts change log / contabo-ops.md).
    const apiDeduped = stripStandaloneManagedKeys(apiOriginal0, apiBlock.map((l) => l.split("=")[0]!).filter((k) => !k.startsWith("#")));
    const apiNext = applyManagedBlockToEnv(apiDeduped.content, apiBlock);
    const apiChanged = apiNext.changed || apiDeduped.changed;
    if (apiChanged) await atomicWriteEnvFile(apiEnvPath, apiNext.content, this.fsImpl);

    const workersOriginal0 = await this.readFile(workersEnvPath);
    // Preserve operator-tuned values (timeouts, token budget) across
    // re-provisions: the rendered block carries catalog defaults, and without
    // this merge a reprovision would silently reset slow-provider tuning
    // (e.g. reasoning models needing >45s per section).
    const preserved = parseEnvValues(workersOriginal0, WORKERS_PRESERVED_KEYS);
    const workersBlock = renderWorkersManagedBlock(config, scopeId);
    const endIdx = workersBlock.length - 1; // end-marker line
    for (const key of WORKERS_PRESERVED_KEYS) {
      const value = preserved[key];
      if (value === undefined) continue;
      const idx = workersBlock.findIndex((l) => l.startsWith(`${key}=`));
      if (idx >= 0) workersBlock[idx] = `${key}=${value}`;
      else workersBlock.splice(endIdx, 0, `${key}=${value}`);
    }
    const workersDeduped = stripStandaloneManagedKeys(workersOriginal0, workersBlock.map((l) => l.split("=")[0]!).filter((k) => !k.startsWith("#")));
    const workersNext = applyManagedBlockToEnv(workersDeduped.content, workersBlock);
    const workersChanged = workersNext.changed || workersDeduped.changed;
    if (workersChanged) await atomicWriteEnvFile(workersEnvPath, workersNext.content, this.fsImpl);

    let restarted = false;
    if (apiChanged || workersChanged) {
      const result = await restartServices(this.execFileFn, this.log);
      restarted = result.ok;
      if (!result.ok) {
        this.log(`provision: restart failed: ${result.stderr ?? "unknown"}`);
      }
    }

    this.log(
      `provision: provider=${config.provider} model=${config.model} apiChanged=${apiChanged} workersChanged=${workersChanged} restarted=${restarted}`,
    );
    return { apiEnvChanged: apiChanged, workersEnvChanged: workersChanged, restarted };
  }

  /**
   * Remove the managed block for a provider/scope and restart. Called on
   * disable and delete.
   */
  async deprovisionGlobalLlm(
    provider: string,
    target: ProvisionTarget = {},
    _audit: ProvisionAudit,
  ): Promise<ProvisionResult> {
    const apiEnvPath = target.apiEnvPath ?? DEFAULT_API_ENV_PATH;
    const workersEnvPath = target.workersEnvPath ?? DEFAULT_WORKERS_ENV_PATH;
    const scopeId = "GLOBAL";

    const apiOriginal = await this.readFile(apiEnvPath);
    const apiNext = removeManagedBlockFromEnv(apiOriginal, provider, scopeId);
    const apiChanged = apiNext.changed;
    if (apiChanged) await atomicWriteEnvFile(apiEnvPath, apiNext.content, this.fsImpl);

    const workersOriginal = await this.readFile(workersEnvPath);
    const workersNext = removeManagedBlockFromEnv(workersOriginal, provider, scopeId);
    const workersChanged = workersNext.changed;
    if (workersChanged) await atomicWriteEnvFile(workersEnvPath, workersNext.content, this.fsImpl);

    let restarted = false;
    if (apiChanged || workersChanged) {
      const result = await restartServices(this.execFileFn, this.log);
      restarted = result.ok;
    }
    this.log(
      `deprovision: provider=${provider} apiChanged=${apiChanged} workersChanged=${workersChanged} restarted=${restarted}`,
    );
    return { apiEnvChanged: apiChanged, workersEnvChanged: workersChanged, restarted };
  }

  private async readFile(path: string): Promise<string> {
    try {
      return await this.fsImpl.readFile(path, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
      throw error;
    }
  }
}

/**
 * Read all GLOBAL enabled LLM PlatformConfiguration rows (decrypted) for
 * backfill on api startup. The caller passes the decrypted secret straight
 * into `RuntimeProvisioner.provisionGlobalLlm`; the secret never leaves
 * memory beyond that call.
 */
export async function decryptPlatformConfigurationSecret(
  ciphertext: string,
  iv: string,
  tag: string,
  masterKey: Buffer,
): Promise<string> {
  const { createDecipheriv } = await import("node:crypto");
  const decipher = createDecipheriv("aes-256-gcm", masterKey, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  const updateChunk = decipher.update(Buffer.from(ciphertext, "base64")) as Buffer;
  const finalChunk = decipher.final() as Buffer;
  return Buffer.concat([updateChunk, finalChunk]).toString();
}

export interface ExistingLlmRow {
  provider: string;
  model: string;
  baseUrl?: string;
  configurationJson: string;
  secretCiphertext: string;
  secretIv: string;
  secretTag: string;
}

/**
 * Backfill helper for the api boot: read all GLOBAL enabled LLM
 * `PlatformConfiguration` rows, decrypt their secrets, and provision the
 * runtime env files via the supplied provisioner. Used so that a provider
 * saved in the SuperAdmin portal takes effect on the runtime even before the
 * operator re-saves the configuration.
 *
 * Returns the number of configs successfully provisioned. Failures on a
 * single row do not abort the whole backfill.
 */
export async function provisionExistingGlobalLlmConfigs(
  query: <T = Record<string, unknown>>(sql: string, ...values: unknown[]) => Promise<T[]>,
  masterKey: Buffer,
  provisioner: RuntimeProvisioner,
): Promise<number> {
  const rows = await query<ExistingLlmRow>(
    `SELECT provider, "configurationJson", "secretCiphertext", "secretIv", "secretTag"
     FROM "PlatformConfiguration"
     WHERE "category"='LLM' AND "enabled"=true AND "scopeType"='GLOBAL'`,
  );
  let provisioned = 0;
  for (const row of rows) {
    try {
      const secretsRaw = await decryptPlatformConfigurationSecret(
        row.secretCiphertext,
        row.secretIv,
        row.secretTag,
        masterKey,
      );
      const secrets = JSON.parse(secretsRaw) as Record<string, string>;
      const apiKey = secrets.apiKey;
      if (!apiKey) continue;
      const config = JSON.parse(String(row.configurationJson || "{}")) as Record<string, unknown>;
      const model = typeof config.model === "string" ? config.model : "";
      const baseUrl = typeof config.baseUrl === "string" ? config.baseUrl : undefined;
      if (!model) continue;
      const result = await provisioner.provisionGlobalLlm(
        { provider: row.provider, model, baseUrl, apiKey },
        {},
        { actor: { sub: "system", email: "system@donordesk" } },
      );
      if (result.apiEnvChanged || result.workersEnvChanged) provisioned++;
    } catch {
      // Best-effort: a single row failure (e.g. corrupt encrypted secret)
      // must not abort provisioning of the remaining rows.
    }
  }
  return provisioned;
}
