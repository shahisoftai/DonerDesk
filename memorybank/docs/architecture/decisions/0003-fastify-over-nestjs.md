# ADR 0003 — Why Fastify over NestJS for Phase 1

## Context
The phased plan recommends NestJS for the API. NestJS provides DI, modular
monolith organisation, and guards that fit the SOLID/hexagonal goals.

## Decision
Phase 1 ships Fastify with a hand-rolled modular structure. The architecture
intends NestJS-equivalent guarantees:
- Hand-wired dependency container (`packages/infrastructure/src/container.ts`)
- One route file per bounded context
- Auth middleware (`apps/api/src/middleware/auth.ts`) analogous to NestJS guard
- Zod schema validation at the route boundary
- `HttpExceptionFilter`-equivalent error handler mapping `DomainError` to
  RFC 7807 problem+json

## Consequences
- We trade ~50% less boilerplate for slightly more wiring code.
- Swap to NestJS is mechanical: each route file becomes a controller; the
  container becomes a module; middleware becomes a guard. The hexagonal
  boundaries (`domain` ← `application` ← `infrastructure` ← `api`) are
  unchanged.
- Future-proof: when the team grows (Conway's Law) and a context is split out,
  the Fastify server becomes a small package that hosts its module independently.
