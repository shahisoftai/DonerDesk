import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { decryptFile, encryptFile, EncryptedStorage, isEncrypted, keyringFromEnv, withEncryptionAtRest } from "../dist/storage/at-rest-encryption.js";
import { encryptStorageTree } from "../dist/storage/encrypt-existing.js";

const b64 = () => randomBytes(32).toString("base64");
const ring = (ids = [1], active) => ({ keys: new Map(ids.map((i) => [i, randomBytes(32)])), activeId: active ?? ids[ids.length - 1] });

function memoryStorage() {
  const files = new Map();
  return {
    files,
    put: async (i) => (files.set(i.key, Buffer.from(i.body)), { url: `/v1/files/${i.key}`, key: i.key, size: files.get(i.key).length }),
    read: async (k) => { if (!files.has(k)) throw new Error("missing"); return files.get(k); },
    getSignedUrl: async (k) => `/v1/files/${k}`,
    remove: async (k) => void files.delete(k),
  };
}

test("a file round-trips, is not readable on disk, and is different each time", () => {
  const r = ring();
  const plain = Buffer.from("beneficiary register: Amina, 0300-1234567");
  const a = encryptFile(plain, "t1/evidence/a.pdf", r);
  const b = encryptFile(plain, "t1/evidence/a.pdf", r);
  assert.ok(isEncrypted(a));
  assert.ok(!a.includes("Amina"));
  assert.notDeepEqual(a, b);
  assert.deepEqual(decryptFile(a, "t1/evidence/a.pdf", r), plain);
});

test("a file moved to another key, or with a changed byte, does not open", () => {
  const r = ring();
  const enc = encryptFile(Buffer.from("secret"), "t1/a", r);
  assert.throws(() => decryptFile(enc, "t1/b", r));
  assert.throws(() => decryptFile(enc, "t2/a", r));
  const tampered = Buffer.from(enc);
  tampered[tampered.length - 1] ^= 1;
  assert.throws(() => decryptFile(tampered, "t1/a", r));
});

test("each organisation has its own key", () => {
  const r = ring();
  const enc = encryptFile(Buffer.from("secret"), "tenant-a/x", r);
  // same bytes presented under another organisation's prefix fail even with the same master key
  assert.throws(() => decryptFile(enc, "tenant-b/x", r));
});

test("storage encrypts on write, reads plaintext legacy files, and reports the original size", async () => {
  const inner = memoryStorage();
  inner.files.set("t1/old.txt", Buffer.from("legacy plaintext"));
  const storage = new EncryptedStorage(inner, ring());
  const put = await storage.put({ key: "t1/new.txt", body: Buffer.from("hello"), contentType: "text/plain" });
  assert.equal(put.size, 5);
  assert.ok(isEncrypted(inner.files.get("t1/new.txt")));
  assert.equal((await storage.read("t1/new.txt")).toString(), "hello");
  assert.equal((await storage.read("t1/old.txt")).toString(), "legacy plaintext");
});

test("the keyring is read from the environment, and a bad one is refused", () => {
  assert.equal(keyringFromEnv({}), null);
  const r = keyringFromEnv({ EVIDENCE_ENCRYPTION_KEYS: `1:${b64()},2:${b64()}` });
  assert.equal(r.activeId, 2);
  assert.equal(keyringFromEnv({ EVIDENCE_ENCRYPTION_KEYS: `1:${b64()},2:${b64()}`, EVIDENCE_ENCRYPTION_ACTIVE: "1" }).activeId, 1);
  assert.throws(() => keyringFromEnv({ EVIDENCE_ENCRYPTION_KEYS: "1:short" }), /32 bytes/);
  assert.throws(() => keyringFromEnv({ EVIDENCE_ENCRYPTION_KEYS: `0:${b64()}` }), /1 to 255/);
  assert.throws(() => keyringFromEnv({ EVIDENCE_ENCRYPTION_KEYS: `1:${b64()}`, EVIDENCE_ENCRYPTION_ACTIVE: "3" }), /not in/);
  const inner = memoryStorage();
  assert.equal(withEncryptionAtRest(inner, null), inner);
});

test("rotation: files written with an older key still open, and the tree can be re-keyed", async () => {
  const k1 = randomBytes(32);
  const k2 = randomBytes(32);
  const old = { keys: new Map([[1, k1]]), activeId: 1 };
  const both = { keys: new Map([[1, k1], [2, k2]]), activeId: 2 };
  const enc = encryptFile(Buffer.from("x"), "t/a", old);
  assert.equal(decryptFile(enc, "t/a", both).toString(), "x");
  assert.throws(() => decryptFile(enc, "t/a", { keys: new Map([[2, k2]]), activeId: 2 }), /key 1/);
});

test("the tree is encrypted in place, idempotently, and a dry run writes nothing", async () => {
  const root = await mkdtemp(join(tmpdir(), "enc-"));
  await mkdir(join(root, "t1", "evidence"), { recursive: true });
  await writeFile(join(root, "t1", "evidence", "a.txt"), "plain a");
  await writeFile(join(root, "t1", "b.txt"), "plain b");
  const r1 = { keys: new Map([[1, randomBytes(32)]]), activeId: 1 };

  const dry = await encryptStorageTree(root, r1, { dryRun: true });
  assert.equal(dry.encrypted, 2);
  assert.equal((await readFile(join(root, "t1", "b.txt"))).toString(), "plain b");

  const first = await encryptStorageTree(root, r1);
  assert.deepEqual([first.encrypted, first.rekeyed, first.failed.length], [2, 0, 0]);
  assert.ok(isEncrypted(await readFile(join(root, "t1", "b.txt"))));
  assert.deepEqual(decryptFile(await readFile(join(root, "t1", "evidence", "a.txt")), "t1/evidence/a.txt", r1), Buffer.from("plain a"));

  const again = await encryptStorageTree(root, r1);
  assert.deepEqual([again.encrypted, again.rekeyed, again.alreadyCurrent], [0, 0, 2]);

  const r2 = { keys: new Map([...r1.keys, [2, randomBytes(32)]]), activeId: 2 };
  const rekey = await encryptStorageTree(root, r2);
  assert.deepEqual([rekey.encrypted, rekey.rekeyed], [0, 2]);
  assert.equal(decryptFile(await readFile(join(root, "t1", "b.txt")), "t1/b.txt", r2).toString(), "plain b");
  assert.deepEqual((await readdir(join(root, "t1"))).filter((n) => n.endsWith(".enc-tmp")), []);
});
