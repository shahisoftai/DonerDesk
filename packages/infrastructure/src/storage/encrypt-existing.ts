import { mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { decryptFile, encryptFile, isEncrypted, type Keyring } from "./at-rest-encryption.js";

export interface EncryptTreeReport {
  encrypted: number;
  rekeyed: number;
  alreadyCurrent: number;
  failed: Array<{ key: string; reason: string }>;
}

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.isFile()) yield path;
  }
}

/**
 * Brings a storage directory under encryption: plaintext files are encrypted, and files written with an older key are re-written
 * with the active one. Safe to run again and again (a file already under the active key is left alone), and safe to interrupt
 * (each file is written next to itself and renamed into place). With `dryRun` nothing is written.
 */
export async function encryptStorageTree(root: string, ring: Keyring, options: { dryRun?: boolean } = {}): Promise<EncryptTreeReport> {
  const report: EncryptTreeReport = { encrypted: 0, rekeyed: 0, alreadyCurrent: 0, failed: [] };
  await mkdir(root, { recursive: true });
  for await (const path of walk(root)) {
    const key = relative(root, path).split(sep).join("/");
    if (key.endsWith(".enc-tmp")) continue;
    try {
      const data = await readFile(path);
      let next: Buffer | null = null;
      if (!isEncrypted(data)) {
        next = encryptFile(data, key, ring);
        report.encrypted += 1;
      } else if (data[6] !== ring.activeId) {
        next = encryptFile(decryptFile(data, key, ring), key, ring);
        report.rekeyed += 1;
      } else {
        report.alreadyCurrent += 1;
      }
      if (next && !options.dryRun) {
        const mode = (await stat(path)).mode;
        const tmp = `${path}.enc-tmp`;
        await writeFile(tmp, next, { mode });
        await rename(tmp, path);
      }
    } catch (error) {
      report.failed.push({ key, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  return report;
}
