import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * Makes a create request repeatable. A client that sends `Idempotency-Key` on a POST gets, for a repeat of the same key
 * (a double click, or a retry after a timeout), the first response back instead of a second record. The key is scoped
 * by tenant + user + route, so it can never leak across users. Requests without the header are untouched.
 */
const HEADER = "idempotency-key";

type Scoped = FastifyRequest & { idempotencyScope?: { tenantId: string; userId: string; route: string; key: string } };

function scopeOf(req: FastifyRequest) {
  const key = req.headers[HEADER];
  if (req.method !== "POST" || typeof key !== "string") return undefined;
  return { tenantId: req.tenant.tenantId.toString(), userId: req.tenant.userId, route: req.routeOptions.url ?? req.url, key };
}

/** preHandler (after authorization): answers a repeat from the stored response, or marks the request as the first. */
export async function idempotencyBegin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const scope = scopeOf(req);
  if (!scope) return;
  const begun = await req.container.requestIdempotency.begin(scope);
  if (!begun.ok) return; // the store is down: run the request normally rather than refuse a create
  const outcome = begun.value;
  if (outcome.kind === "INVALID_KEY") {
    return void reply.status(400).send({ type: "https://donordesk/problems/validation", title: "The idempotency key is not valid.", status: 400, requestId: req.id });
  }
  if (outcome.kind === "IN_PROGRESS") {
    return void reply
      // 503 + Retry-After, not 409: the web client retries those on its own with the same key, and a real conflict is not retried.
      .status(503)
      .header("retry-after", "2")
      .send({ type: "https://donordesk/problems/unavailable", title: "This was already sent and is still being saved. Wait a moment.", status: 503, code: "IDEMPOTENCY_IN_PROGRESS", requestId: req.id });
  }
  if (outcome.kind === "REPLAY") {
    return void reply
      .status(outcome.statusCode)
      .header("idempotent-replayed", "true")
      .type(outcome.contentType ?? "application/json")
      .send(outcome.body);
  }
  (req as Scoped).idempotencyScope = scope;
}

/** onSend: stores a successful first response for replay; a failed one frees the key. */
export async function idempotencyFinish(req: FastifyRequest, reply: FastifyReply, payload: unknown): Promise<unknown> {
  const scope = (req as Scoped).idempotencyScope;
  if (!scope) return payload;
  (req as Scoped).idempotencyScope = undefined;
  const contentType = String(reply.getHeader("content-type") ?? "application/json");
  // Only JSON bodies are replayed; anything streamed is left alone and its key freed.
  const body = typeof payload === "string" ? payload : undefined;
  await req.container.requestIdempotency.finish(
    scope,
    body !== undefined && contentType.includes("json") ? { statusCode: reply.statusCode, body, contentType } : { statusCode: 500, body: "" },
  );
  return payload;
}
