-- Report charts: per-section chart configuration chosen by the user before
-- the report is finalised. `chartConfigJson` stores { type, dataBinding, options }.

-- AlterTable
ALTER TABLE "ReportSection" ADD COLUMN     "chartConfigJson" TEXT;
