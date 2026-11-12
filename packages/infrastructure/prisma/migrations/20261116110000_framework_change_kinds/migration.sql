-- Phase 52.3: what each framework version touched (results and reasoning, or how they are measured). Additive; older rows read as empty.
ALTER TABLE "LogframeVersion" ADD COLUMN "changeKinds" TEXT NOT NULL DEFAULT '';
