-- Phase 38: the Project Creation Wizard's own decisions, stored beside the document proposal (additive).
ALTER TABLE "ProjectSetupProposal" ADD COLUMN "extrasJson" TEXT NOT NULL DEFAULT '{}';
