import { execSync } from "node:child_process";
const DATABASE_URL = process.env.DATABASE_ADMIN_URL ?? "postgresql://donordesk:donordesk-dev@localhost:5432/donordesk";

console.log("Pushing Prisma schema to configured PostgreSQL database...");
execSync(`pnpm exec prisma db push --skip-generate --accept-data-loss`, {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL },
});

console.log("Generating prisma client...");
execSync(`pnpm exec prisma generate`, { stdio: "inherit", env: { ...process.env, DATABASE_URL } });

console.log("Applying tenant row-level-security policies...");
execSync(`psql "${DATABASE_URL}" --set ON_ERROR_STOP=1 --file ../../infra/postgres/rls.sql`, { stdio: "inherit" });

console.log("Backfilling baseline report revisions...");
execSync(`psql "${DATABASE_URL}" --set ON_ERROR_STOP=1 --file ../../infra/postgres/backfill-report-revisions.sql`, { stdio: "inherit" });

console.log("Migration complete.");
