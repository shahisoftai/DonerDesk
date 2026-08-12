import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

const DATABASE_URL = process.env.DATABASE_ADMIN_URL ?? "postgresql://donordesk:donordesk-dev@localhost:5432/donordesk";

console.log("Seeding configured PostgreSQL database...");

const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } },
});

async function main() {
  const tenantId = "demo-tenant";
  await prisma.$executeRaw`SELECT set_config('app.current_tenant', ${tenantId}, false)`;
  const existing = await prisma.organization.findUnique({ where: { tenantId } });
  if (existing) {
    console.log("Seed already present, skipping.");
    return;
  }

  const passwordHash = await bcrypt.hash("password123", 10);

  await prisma.organization.create({
    data: {
      id: randomUUID(),
      tenantId,
      name: "Acme Humanitarian NGO",
      organizationType: "LOCAL_NGO",
      country: "Pakistan",
      sectors: JSON.stringify(["NUTRITION", "FOOD_SECURITY"]),
      contactName: "Admin User",
      contactEmail: "admin@example.org",
      defaultLanguage: "en",
    },
  });

  await prisma.user.create({
    data: {
      id: randomUUID(),
      tenantId,
      email: "admin@example.org",
      name: "Admin User",
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  console.log("Seed created. Login: admin@example.org / password123 (tenant: demo-tenant).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
