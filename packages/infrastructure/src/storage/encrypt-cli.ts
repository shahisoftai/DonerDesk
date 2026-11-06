import { encryptStorageTree } from "./encrypt-existing.js";
import { keyringFromEnv } from "./at-rest-encryption.js";

/** `pnpm --filter @donordesk/infrastructure storage:encrypt [--dry-run]`: encrypts every stored file under STORAGE_ROOT (idempotent). */
async function main(): Promise<void> {
  const ring = keyringFromEnv();
  if (!ring) {
    console.error("EVIDENCE_ENCRYPTION_KEYS is not set: nothing to encrypt with.");
    process.exit(2);
  }
  const root = process.env.STORAGE_ROOT ?? "./storage";
  const dryRun = process.argv.includes("--dry-run");
  const report = await encryptStorageTree(root, ring, { dryRun });
  console.log(`${dryRun ? "[dry run] " : ""}${root}: ${report.encrypted} encrypted, ${report.rekeyed} re-keyed, ${report.alreadyCurrent} already current, ${report.failed.length} failed`);
  for (const f of report.failed) console.error(`  ${f.key}: ${f.reason}`);
  process.exit(report.failed.length > 0 ? 1 : 0);
}

void main();
