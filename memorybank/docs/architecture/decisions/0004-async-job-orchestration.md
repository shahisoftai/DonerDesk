# ADR 0004 — Async job ownership and orchestration

## Status
Accepted (2026-08-13)

## Context
DonorDesk has asynchronous work (evidence tagging, document parsing, activity
polish, report drafting, readiness recompute, checklist generation, export on
close, deadline reminders). Phase 1 handled this in-process with an
`InMemoryJobQueue` that only logged. The Kestra implementation plan requires a
durable, retryable orchestrator without coupling the application layer to any
queue technology.

## Decision
- Define the canonical set of job classes in one enum (`JOB_NAMES` in
  `packages/contracts`) and a `JobEnvelopeSchema` wire format.
- Application use-cases depend only on the `IJobQueue` port
  (`enqueue(name, payload)`) and publish domain events via `IEventBus`.
- `createJobQueue(logger)` selects the implementation from `JOB_QUEUE`:
  - `memory` (default) — `JobDispatcher` runs registered handlers in-process;
    safe fallback and the pre-Kestra behaviour.
  - `redis` — `BullMQJobQueue` adapts the existing `PriorityJobQueue`.
  - `kestra` — `KestraJobQueue` triggers a Kestra flow via the executions API,
    resolving the flow from a mapping table (OCP).
- The `OutboxEventBus` maps domain events (e.g. `evidence.uploaded`) to jobs,
  so the API/outbox is the trigger seam; no use-case changes when swapping the
  queue backend.
- Writes performed by orchestrator-triggered jobs are idempotency-keyed
  (durable `IdempotencyRecord`) so retries and duplicate deliveries do not
  double-apply.

## Consequences
- **Positive:** queue technology is a deployment detail (`JOB_QUEUE`); adding a
  job class = add a `JOB_NAMES` entry + a flow-mapping row + (for memory mode) a
  dispatcher handler; the synchronous core works with the default memory queue.
- **Trade-off:** Kestra/BullMQ durability only takes effect when those backends
  are deployed and `JOB_QUEUE` is switched; memory mode is not durable across
  restarts (documented).
- **Safety:** loopback-only bindings, internal token + HMAC auth on `/internal/*`
  routes, and idempotency keys are enforced before production use.
