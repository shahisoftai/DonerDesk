import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildMimeMessage, SendmailEmailAdapter } from "../dist/comms/sendmail-email.js";

test("a header value can never carry a line break (no header injection)", () => {
  const mime = buildMimeMessage(
    { to: "a@example.org\r\nBcc: x@example.org", subject: "Hello\nBcc: y@example.org", html: "<p>Hi</p>" },
    "DonorDesk <n@donordesk.online>",
    "donordesk.online",
  );
  const head = mime.split("\r\n\r\n")[0];
  assert.ok(!/^Bcc:/m.test(head));
  assert.match(mime, /^From: DonorDesk <n@donordesk\.online>/);
  assert.match(mime, /multipart\/alternative/);
});

test("a non-ASCII subject is encoded", () => {
  const mime = buildMimeMessage({ to: "a@example.org", subject: "Rapport d'activité", html: "<p>x</p>" }, "n@donordesk.online", "donordesk.online");
  assert.match(mime, /^Subject: =\?UTF-8\?B\?/m);
});

test("hands the message to sendmail with the envelope sender, and reports its failure", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sendmail-"));
  const out = join(dir, "captured.txt");
  const ok = join(dir, "ok.sh");
  writeFileSync(ok, `#!/bin/sh\necho "$@" > ${out}\ncat >> ${out}\n`);
  chmodSync(ok, 0o755);
  const adapter = new SendmailEmailAdapter({ fromAddress: "notifications@donordesk.online" }, ok);
  const result = await adapter.send({ to: "a@example.org", subject: "Hi", html: "<p>Hello</p>" });
  assert.equal(result.success, true);
  const captured = readFileSync(out, "utf8");
  assert.match(captured, /^-t -i -f notifications@donordesk\.online/);
  assert.match(captured, /To: a@example\.org/);

  const bad = join(dir, "bad.sh");
  writeFileSync(bad, "#!/bin/sh\ncat >/dev/null\necho refused >&2\nexit 75\n");
  chmodSync(bad, 0o755);
  const failed = await new SendmailEmailAdapter({ fromAddress: "n@donordesk.online" }, bad).send({ to: "a@example.org", subject: "Hi", html: "x" });
  assert.equal(failed.success, false);
  assert.match(failed.error, /refused/);
});
