# Feature 34: Background jobs — nothing the system asked for is silently lost

**DonorDesk Version 2.006**

**Author:** Claude (agent) · **Date:** 2026-10-21
**Status:** Built, tested and deployed 2026-10-20 (batch 3, audit finding H-18). The default queue is still in-process; see §4. Builds on [Feature 20](20-report-gen.md) and [Feature 16](16-Audit-Log.md).

## 1. What a user gets

Nothing new on screen. What changes is what happens when the background system is unavailable (for example Kestra restarting):

- The request that caused the job still succeeds.
- The job is **kept** and handed over again later, with waits that grow: 30 seconds, a minute, two, four, up to an hour, for at most eight tries.
- After the last try the job is **dead-lettered**: kept, no longer retried, and logged at error level (`job.dead_lettered`) for an operator to look at.

Examples of work that goes through this path: evidence tagging after an upload, workspace provisioning, the first checklist for a new reporting period.

## 2. Rules that matter

- **A failed hand-off never fails the change that caused it.** The domain change is already committed; the job is recovered from its own record.
- **Each job is claimed by one runner at a time** (a five-minute hold), so two API instances do not send the same job twice.
- **The retry loop runs every minute** in the API (`JOB_RETRY_INTERVAL_MS`; 0 turns it off).
- **Times are stored in UTC.** The claim query converts explicitly, so a server in another time zone behaves the same.

## 3. Where it lives

| Layer | Path |
|---|---|
| Application | `ports/infrastructure.ts` (`IFailedJobStore`) |
| Infrastructure | `jobs/retry-runner.ts` (`JobRetryRunner`, `retryDelayMs`, `MAX_JOB_ATTEMPTS`), `repositories/failed-jobs.ts` (`PrismaFailedJobStore`), `events/outbox-event-bus.ts` (keeps a failed job), table `JobOutbox` (migration `20261021170000_job_outbox`, forced RLS) |
| API | `apps/api/src/server.ts` (the retry loop) |
| Tests | `packages/infrastructure/test/job-retry.test.mjs`; `failed-jobs.integration.test.mjs` (real database, both session time zones) |

## 4. Limits

- **The default queue is still in-process.** A job that is running when the API restarts is lost unless it was a failed hand-off already recorded. A durable queue (BullMQ or Kestra with recorded runs) remains open.
- Dead-lettered jobs are not yet listed in an admin screen; they are read from the table or the journal.
- A retried job may run again after a partial failure, so the handlers that receive jobs must be repeatable. A job that cannot be repeated safely needs its own check before it is recorded here.
