-- An indicator with recorded values is retired, not deleted: reports that used it keep their history.
ALTER TABLE "Indicator" ADD COLUMN "archivedAt" TIMESTAMP(3);
