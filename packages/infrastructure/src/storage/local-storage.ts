import { mkdir, writeFile, readFile, unlink, stat } from "node:fs/promises";
import { resolve, dirname, sep } from "node:path";
import { randomBytes } from "node:crypto";
import type { IStorage, StoragePutInput, StoragePutResult } from "@donordesk/application";

const ROOT = process.env.STORAGE_ROOT ?? "./storage";

function safePath(key: string): string {
  const root = resolve(ROOT);
  const path = resolve(root, key);
  if (path !== root && !path.startsWith(`${root}${sep}`)) {
    throw new Error("Invalid storage key");
  }
  return path;
}

export class LocalStorage implements IStorage {
  async put(input: StoragePutInput): Promise<StoragePutResult> {
    const path = safePath(input.key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, input.body);
    const stats = await stat(path);
    return {
      url: `/v1/files/${encodeURIComponent(input.key)}`,
      key: input.key,
      size: stats.size,
    };
  }

  async getSignedUrl(key: string, _ttlSeconds: number): Promise<string> {
    const token = randomBytes(16).toString("hex");
    return `/v1/files/${encodeURIComponent(key)}?t=${token}`;
  }

  async remove(key: string): Promise<void> {
    const path = safePath(key);
    try {
      await unlink(path);
    } catch {
      // best-effort
    }
  }

  async read(key: string): Promise<Buffer> {
    const path = safePath(key);
    return readFile(path);
  }

  static resolveRoot(): string {
    return ROOT;
  }
}
