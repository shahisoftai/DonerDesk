import test from "node:test";
import assert from "node:assert/strict";
import { EmailContactSalesNotifier } from "../dist/comms/email-contact-sales-notifier.js";

const inquiry = { name: "Ada <b>", email: "ada@example.org", organization: "Acme", message: "Hello" };

test("sends the inquiry to the sales inbox, escaped", async () => {
  let sent;
  const n = new EmailContactSalesNotifier({ send: async (m) => ((sent = m), { success: true }) }, "support@donordesk.online");
  const r = await n.notify(inquiry);
  assert.equal(r.ok, true);
  assert.equal(sent.to, "support@donordesk.online");
  assert.match(sent.subject, /Acme/);
  assert.ok(!sent.html.includes("<b>"));
});

test("a failed send is reported to the visitor", async () => {
  const n = new EmailContactSalesNotifier({ send: async () => ({ success: false, error: "x" }) }, "support@donordesk.online");
  const r = await n.notify(inquiry);
  assert.equal(r.ok, false);
});
