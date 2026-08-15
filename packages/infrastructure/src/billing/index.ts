import type { BillingProvider } from "@donordesk/application";
import { CreemBillingProvider } from "./creem.js";
import { StubBillingProvider } from "./stub.js";

/**
 * Selects the billing provider from `BILLING_PROVIDER` (default `stub`).
 * One factory keeps selection in one place (SRP/DIP); dev/tests use the stub,
 * production uses Creem.
 */
export function createBillingProvider(): BillingProvider {
  const mode = process.env.BILLING_PROVIDER ?? "stub";
  if (mode === "creem") {
    return new CreemBillingProvider();
  }
  return new StubBillingProvider();
}

export { CreemBillingProvider } from "./creem.js";
export { StubBillingProvider } from "./stub.js";
