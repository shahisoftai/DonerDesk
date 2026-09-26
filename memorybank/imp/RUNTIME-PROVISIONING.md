# Runtime Provisioning — Implementation Plan & Result

**Status:** IMPLEMENTED + DEPLOYED + BROWSER-VERIFIED (releaseId `20260901140002` on Contabo).
**Date:** 2026-09-01
**Related docs:** `memorybank/Fixes.md` (section "Report-Quality root cause + … deploy hardening + AI runtime provisioning"), `memorybank/contabo-ops.md` (Runtime provisioning + MiniMax fix), `memorybank/imp/LLM-PROVIDER-WIRING.md` §18 + §19, `memorybank/SUPERADMIN-PORTAL.md`.

## 1. Problem

Selecting DeepSeek / MiniMax on `sa.donordesk.online` previously only wrote to `PlatformConfiguration` (the SuperAdmin control-plane table). The runtime services — the api (which selects a generator) and the worker (which actually calls the provider) — read provider config from **env files** (`/opt/donordesk/shared/{api,workers}.env`) only. There was **no automated path** from the control plane to the runtime env files. Operators had to copy secrets manually, which never happened, so every generation fell through to the deterministic stub.

Symptoms:
- "Test connection" on sa.donordesk returned SUCCESS (the control plane decrypts the key and calls the provider directly), but every report draft on donordesk.online used the stub.
- Even when an operator edited the env files by hand, a `systemctl restart donordesk-workers` was needed because the worker process had cached the old env.

## 2. Goal

Selecting a provider on `sa.donordesk.online` should make the provider live on `donordesk.online` automatically — without an operator copy step — and with the worker picking up the new env without manual intervention.

## 3. Design

- **Atomic, idempotent env-file writer** at `/opt/donordesk/shared/{api,workers}.env`.
- **Scoped, auditable restart** via `sudo systemctl restart donordesk-{api,workers}` only.
- **No secret in logs / argv / command line** — only in the env file.
- **TENANT-scoped LLM** stays on the `LlmConfigResolver` path (not env files); only **GLOBAL-scoped** LLM is env-provisioned (the AI Reporter reads env, not per-tenant DB).
- **Boot backfill** so a save made while the api is running still takes effect after the next api restart (idempotent re-provision).

## 4. Implementation

### New: `packages/infrastructure/src/platform/runtime-provisioner.ts`
- `RuntimeProvisioner` class with `provisionGlobalLlm(config, target, audit)` and `deprovisionGlobalLlm(provider, target, audit)`.
- `renderApiManagedBlock` writes `AI_REPORTER_ENABLED=1`, `AI_REPORTER_URL`, `AI_REPORTER_PROVIDER`, `AI_REPORTER_MODEL`, `LLM_PROVIDER`.
- `renderWorkersManagedBlock` writes `AI_REPORTER_PROVIDER`, `AI_REPORTER_MODEL`, optional `AI_REPORTER_BASE_URL`, **`AI_REPORTER_API_KEY`** (the only place the secret lives), timeouts (`AI_REPORTER_TIMEOUT`, `AI_REPORTER_DRAFT_TIMEOUT_MS`, `AI_REPORTER_TOTAL_DRAFT_TIMEOUT_MS`), `AI_REPORTER_CONTRACT_VERSION=2`.
- `applyManagedBlockToEnv(content, newBlock)` / `removeManagedBlockFromEnv(content, provider, scopeId)` — idempotent, identified by `# dd-managed:LLM:GLOBAL:<provider>:<scopeId>` … `# dd-end-managed:LLM` marker block.
- `atomicWriteEnvFile(path, content)` — temp → `chmod 0640` → `chown donordesk:donordesk` → rename. Preserves existing ownership on re-provision.
- `restartServices` via `execFile` of `/usr/bin/sudo` + `/usr/bin/systemctl restart donordesk-{api,workers}`. No shell, args only, scoped.
- Exported via `packages/infrastructure/src/index.ts` for the api + tests.

### Wired into `packages/infrastructure/src/platform/control-plane.ts`
- `PlatformControlPlane` constructor accepts `RuntimeProvisionerDeps` (defaults to real fs + `execFile`).
- `upsertConfiguration`: after the DB write + audit, if `category === "LLM"` and `scopeType === "GLOBAL"` and `enabled === true`, decrypt the new secret and call `provisionGlobalLlm`. If `enabled === false`, call `deprovisionGlobalLlm`. Failures are audited (`configuration.provisioning_failed`) and don't roll back the save.
- `deleteConfiguration`: best-effort `deprovisionGlobalLlm` for GLOBAL LLM configs.

### API boot backfill — `apps/api/src/server.ts`
- `start()` (after `app.listen()`) reads `PLATFORM_MASTER_KEY`, decrypts every GLOBAL enabled LLM `PlatformConfiguration` row, calls `provisionGlobalLlm` for each. Failures are logged and never block the api.
- First boot of the new code provisioned the pre-existing DeepSeek row (the operator's previous sa.donordesk selection) automatically; the MiniMax row required the operator to paste a key + save on sa.donordesk.

### MiniMax "Test connection" 404 — fixed in the same cycle
- `testProvider` in `control-plane.ts` built the URL as `baseUrl + paths[provider]`. With operator-saved `baseUrl = "https://api.minimax.io/v1"` and `paths["minimax"] = "/v1/models"`, the URL became `https://api.minimax.io/v1/v1/models` → 404. Fix: strip a trailing `/v1` segment from `baseUrl` before appending the provider path:
  ```ts
  config.baseUrl.trim().replace(/\/(v1)\/?$/, "").replace(/\/+$/, "")
  ```
- Verified: `POST /superadmin/configurations/<minimax-id>/test` → `{status:SUCCESS, message:"Connection and credentials verified"}`. Same for DeepSeek.

## 5. Host setup (operator one-time, root)

- `/etc/sudoers.d/donordesk-restart` (`0440`, root):
  `donordesk ALL=(root) NOPASSWD: /usr/bin/systemctl restart donordesk-api, /usr/bin/systemctl restart donordesk-workers`.
- `donordesk-api.service`: `ReadWritePaths=/opt/donordesk/shared /opt/donordesk/shared/storage` (expanded so the api process, `User=donordesk`, can write the env files).
- `/opt/donordesk/shared/{api,workers}.env` chowned to `donordesk:donordesk` mode `0640`.

## 6. Regression tests

`packages/infrastructure/test/runtime-provisioner.test.mjs` (5 tests):
- `applyManagedBlockToEnv`: inserts, updates, **idempotent on identical content** (normalised trailing whitespace).
- `removeManagedBlockFromEnv`: removes only the targeted block, preserves unrelated content, idempotent.
- `renderWorkersManagedBlock`: contains provider/model/apiKey/timeouts/contract version; apiKey is in the rendered text (used by the env file, never logged).
- `RuntimeProvisioner.provisionGlobalLlm`: writes both env files, triggers exactly the two scoped restart commands, **never logs the secret** (asserted by scanning every log line), idempotent on re-provision.
- `RuntimeProvisioner.deprovisionGlobalLlm`: removes blocks + restarts.

## 7. Verified result

- DeepSeek: Test connection SUCCESS; real AI Executive Summary in ~6s (`30 learning centres against a target of 120`).
- MiniMax: Test connection SUCCESS; real AI Executive Summary in ~57s.
- Both providers produce `parseOutcome: VALID, critiqueIssues: 0, validatorIssues: []`.

## 8. Known sharp edge — worker reload on subsequent saves

If a provider is saved *while the api is already running* (e.g., operator toggles enable or pastes a key on sa.donordesk), `upsertConfiguration` writes the env files and calls `restartServices` (api + workers). In one observed case the workers restart did not take effect and the worker held a stale key → 401 against the new provider. Operational mitigation: one-time `systemctl restart donordesk-workers`. A more robust detection (verify worker pid loaded the new env, with a stronger retry) is a deploy-tooling item, not a product regression — tracked separately.

## Update 2026-09-26 (release `20260926153744`)

- `workers.env` is now a **fallback only**. The api resolves the tenant's own or the platform-default SuperAdmin LLM configuration per generation, and sends the provider, model and key with each worker request.
- `renderWorkersManagedBlock`: `AI_REPORTER_DRAFT_TIMEOUT_MS=90000`, `AI_REPORTER_TOTAL_DRAFT_TIMEOUT_MS=200000`, `AI_REPORTER_CONTRACT_VERSION=4`.
- `renderApiManagedBlock`: adds `AI_REPORTER_HTTP_TIMEOUT_MS=240000` (preserved key) and `AI_REPORTER_CONTRACT_VERSION=4`.
- Enabling an existing card (no new key typed) now provisions it from the stored secret.
- **Race observed on deploy:** the api's boot-time re-provision rewrote both env files about 3 s after the deploy restart, so the services ran on stale env until they were restarted again. Compare `/proc/<pid>/environ` with the env files after a deploy.
