import type { FastifyInstance, FastifyRequest } from "fastify";
import { ContactSalesInquirySchema } from "@donordesk/contracts";
import { DomainError } from "@donordesk/domain";

/**
 * Minimal in-process sliding-window rate limiter for public intake routes.
 * Single-instance only (the api runs as one node process per deploy), no new
 * dependency — enough to blunt form-spam abuse on an unauthenticated endpoint.
 * A multi-instance deployment should move this to a shared store or a gateway.
 */
class IpRateLimiter {
  private readonly hits = new Map<string, number[]>();
  constructor(
    private readonly windowMs: number,
    private readonly maxPerWindow: number,
  ) {
    // Periodic sweep so one-off attacker IPs don't pin memory.
    setInterval(() => {
      const cutoff = Date.now() - this.windowMs;
      for (const [ip, times] of this.hits) {
        const alive = times.filter((t) => t > cutoff);
        if (alive.length === 0) this.hits.delete(ip);
        else this.hits.set(ip, alive);
      }
    }, this.windowMs).unref();
  }

  allow(key: string): boolean {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const times = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (times.length >= this.maxPerWindow) {
      this.hits.set(key, times);
      return false;
    }
    times.push(now);
    this.hits.set(key, times);
    return true;
  }
}

function clientIp(req: FastifyRequest): string {
  // req.ip is resolved via Fastify's trustProxy setting (server.ts), which
  // trusts only the local nginx hop — this does not read the raw client
  // header directly, so it isn't spoofable by a client-supplied
  // X-Forwarded-For the way a manual header parse would be.
  return req.ip || "unknown";
}

/**
 * Public, unauthenticated Enterprise intake (WS-I.1). Registered alongside
 * auth/webhook routes, outside the tenant-auth middleware block. Rate-limited
 * per client IP (5 per hour) — the plan's WS-I note deferred this; it ships
 * now as a plain in-process limiter.
 */
export async function registerSalesRoutes(app: FastifyInstance) {
  const limiter = new IpRateLimiter(60 * 60 * 1000, 5);
  app.post("/v1/contact-sales", async (req) => {
    if (!limiter.allow(clientIp(req))) {
      throw new DomainError("RATE_LIMITED", "Too many inquiries from this address. Please try again later.");
    }
    const body = ContactSalesInquirySchema.parse(req.body);
    if (body.website) {
      // Honeypot tripped: report success to the bot without sending anything.
      return { ok: true };
    }
    const result = await app.container.handlers.submitContactSalesInquiry.handle({
      name: body.name,
      email: body.email,
      organization: body.organization,
      message: body.message,
    });
    if (!result.ok) throw result.error as DomainError;
    return { ok: true };
  });
}
