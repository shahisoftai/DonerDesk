-- Phase 28.1-K: the numbers a project sets for an automation rule (JSON of name -> whole number). Additive only; null = the rule's defaults.
ALTER TABLE "ProjectAutomation" ADD COLUMN "settingsJson" TEXT;
