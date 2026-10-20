import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Applies the checked-in migrations, then the raw SQL steps, then checks that
 * the database and schema.prisma agree.
 *
 * The old `db:migrate` pushes the schema with `prisma db push`, which never
 * executes the 58 migration files: a broken or destructive migration shipped
 * undetected, and a divergence between the migrations and the schema stayed
 * invisible. This is what CI and production use; `db:migrate` remains the
 * local-development convenience.
 */
const DATABASE_URL = process.env.DATABASE_ADMIN_URL ?? "postgresql://donordesk:donordesk-dev@localhost:5432/donordesk";
const REPO_ROOT = resolve(join(new URL(".", import.meta.url).pathname, "../../../.."));

function run(command: string): void {
  execSync(command, { stdio: "inherit", env: { ...process.env, DATABASE_URL } });
}

function psql(file: string): void {
  const path = join(REPO_ROOT, file);
  if (!existsSync(path)) {
    console.log(`Skipping ${file} (not present).`);
    return;
  }
  execSync(`psql "${DATABASE_URL}" --set ON_ERROR_STOP=1 --file ${path}`, { stdio: "inherit" });
}

console.log("Applying the checked-in migrations...");
run("pnpm exec prisma migrate deploy");

console.log("Generating prisma client...");
run("pnpm exec prisma generate");

console.log("Applying tenant row-level-security policies...");
psql("infra/postgres/rls.sql");

console.log("Applying pgvector extension and vector column...");
psql("infra/postgres/pgvector.sql");

console.log("Backfilling baseline report revisions...");
psql("infra/postgres/backfill-report-revisions.sql");

console.log("Checking that the migrations and schema.prisma agree...");
execSync(`bash ${join(REPO_ROOT, "scripts/check-migration-drift.sh")} "${DATABASE_URL}"`, { stdio: "inherit" });

console.log("Migration complete.");
