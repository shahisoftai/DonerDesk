import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db/prisma.js";
import { createEmbeddingGenerator } from "./embedding-generator.js";
import { PrismaEmbeddingStore } from "../repositories/embedding-store.js";
import { EmbeddingBackfillJob } from "./embedding-backfill.js";

async function main(): Promise<void> {
  const prisma: PrismaClient = defaultPrisma;
  const generator = createEmbeddingGenerator();
  const store = new PrismaEmbeddingStore(prisma);
  const job = new EmbeddingBackfillJob(prisma, generator, store);
  const result = await job.run();
  console.log(JSON.stringify({ status: "ok", ...result }));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
