import { randomBytes } from "node:crypto";
import { prisma } from "../db/prisma.js";
import { PlatformControlPlane } from "./control-plane.js";

const email = process.env.SUPERADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
const name = process.env.SUPERADMIN_BOOTSTRAP_NAME?.trim() || "DonorDesk SuperAdmin";
const password = process.env.SUPERADMIN_BOOTSTRAP_PASSWORD || randomBytes(18).toString("base64url");

if (!email) throw new Error("SUPERADMIN_BOOTSTRAP_EMAIL is required");
await new PlatformControlPlane(prisma).bootstrap(email, name, password);
process.stdout.write(`SuperAdmin created. One-time password: ${password}\nChange it after activation and do not store it in shell history.\n`);
await prisma.$disconnect();
