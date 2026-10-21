import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { buildMimeMessage, LocalSmtpEmailAdapter } from "../dist/comms/local-smtp-email.js";

/** A throwaway SMTP server on the loopback interface; `rejectRcpt` makes it refuse the recipient. */
async function fakeSmtp({ rejectRcpt = false } = {}) {
  const seen = { commands: [], data: "" };
  const server = createServer((socket) => {
    socket.setEncoding("utf8");
    let inData = false;
    let buf = "";
    socket.write("220 fake ESMTP\r\n");
    socket.on("data", (chunk) => {
      buf += chunk;
      if (inData) {
        if (buf.endsWith("\r\n.\r\n")) {
          seen.data = buf;
          buf = "";
          inData = false;
          socket.write("250 OK queued as ABC123\r\n");
        }
        return;
      }
      let i;
      while ((i = buf.indexOf("\r\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        seen.commands.push(line);
        if (line.startsWith("EHLO")) socket.write("250-fake\r\n250-SIZE 100\r\n250 8BITMIME\r\n");
        else if (line.startsWith("RCPT") && rejectRcpt) socket.write("550 no such user\r\n");
        else if (line === "DATA") { socket.write("354 go\r\n"); inData = true; break; }
        else if (line === "QUIT") socket.write("221 bye\r\n");
        else socket.write("250 OK\r\n");
      }
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, seen, port: server.address().port };
}

test("a header value can never carry a line break (no header injection)", () => {
  const mime = buildMimeMessage(
    { to: "a@example.org\r\nBcc: x@example.org", subject: "Hello\nBcc: y@example.org", html: "<p>Hi</p>" },
    "DonorDesk <n@donordesk.online>",
    "donordesk.online",
  );
  assert.ok(!/^Bcc:/m.test(mime.split("\r\n\r\n")[0]));
  assert.match(mime, /multipart\/alternative/);
});

test("a non-ASCII subject is encoded", () => {
  const mime = buildMimeMessage({ to: "a@example.org", subject: "Rapport d'activité", html: "<p>x</p>" }, "n@donordesk.online", "donordesk.online");
  assert.match(mime, /^Subject: =\?UTF-8\?B\?/m);
});

test("delivers one message over SMTP with the envelope sender and recipient", async () => {
  const { server, seen, port } = await fakeSmtp();
  try {
    const adapter = new LocalSmtpEmailAdapter({ fromAddress: "notifications@donordesk.online" }, "127.0.0.1", port);
    const result = await adapter.send({ to: "Ada <ada@example.org>", subject: "Hi", html: "<p>Hello</p>" });
    assert.equal(result.success, true);
    assert.ok(seen.commands.includes("MAIL FROM:<notifications@donordesk.online>"));
    assert.ok(seen.commands.includes("RCPT TO:<ada@example.org>"));
    assert.match(seen.data, /Subject: Hi/);
  } finally {
    server.close();
  }
});

test("a refused recipient is reported, not swallowed", async () => {
  const { server, port } = await fakeSmtp({ rejectRcpt: true });
  try {
    const adapter = new LocalSmtpEmailAdapter({ fromAddress: "n@donordesk.online" }, "127.0.0.1", port);
    const result = await adapter.send({ to: "nobody@example.org", subject: "Hi", html: "x" });
    assert.equal(result.success, false);
    assert.match(result.error, /550/);
  } finally {
    server.close();
  }
});

test("an unreachable server is a failed result, not an exception", async () => {
  const adapter = new LocalSmtpEmailAdapter({ fromAddress: "n@donordesk.online" }, "127.0.0.1", 1, 2000);
  const result = await adapter.send({ to: "a@example.org", subject: "Hi", html: "x" });
  assert.equal(result.success, false);
});
