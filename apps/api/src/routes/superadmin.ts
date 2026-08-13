import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { PlatformControlPlane } from "@donordesk/infrastructure";

const Login = z.object({ email: z.string().email(), password: z.string().min(1) });
const Mfa = z.object({ token: z.string().min(1), code: z.string().regex(/^\d{6}$/) });
const Config = z.object({ id: z.string().optional(), scopeType: z.enum(["GLOBAL", "TENANT"]).default("GLOBAL"), scopeId: z.string().optional(), category: z.enum(["LLM", "EMAIL", "OBJECT_STORAGE", "BACKUP", "CONNECTOR"]), provider: z.string().min(1), displayName: z.string().min(1), enabled: z.boolean(), configuration: z.record(z.string(), z.unknown()).default({}), secrets: z.record(z.string(), z.string()).optional() });
const UserUpdate = z.object({ name: z.string().min(1).optional(), status: z.enum(["INVITED", "ACTIVE", "SUSPENDED", "REMOVED"]).optional(), role: z.enum(["ADMIN", "PROJECT_MANAGER", "ME_OFFICER", "GRANTS_OFFICER", "FIELD_OFFICER", "COMPLIANCE_OFFICER", "VIEWER"]).optional(), password: z.string().min(12).optional() });
const UserCreate = z.object({ tenantId: z.string().min(1), email: z.string().email(), name: z.string().min(1), role: z.enum(["ADMIN", "PROJECT_MANAGER", "ME_OFFICER", "GRANTS_OFFICER", "FIELD_OFFICER", "COMPLIANCE_OFFICER", "VIEWER"]), status: z.enum(["INVITED", "ACTIVE", "SUSPENDED"]).default("ACTIVE"), password: z.string().min(12) });
const TenantCreate = z.object({ name: z.string().min(2), tenantId: z.string().regex(/^[a-z0-9][a-z0-9-]{2,62}$/), organizationType: z.string().min(2), country: z.string().min(2), sectors: z.array(z.string()).default([]), contactName: z.string().min(2), contactEmail: z.string().email(), website: z.string().url().optional().or(z.literal("")), defaultLanguage: z.string().min(2).default("en"), dataResidency: z.enum(["DEFAULT", "EU", "US", "AFRICA", "ASIA"]), aiEnabled: z.boolean() });
const TenantUpdate = TenantCreate.omit({ tenantId: true }).partial();

export async function registerSuperAdminRoutes(app: FastifyInstance) {
  let platform: PlatformControlPlane | undefined;
  const service = () => platform ??= new PlatformControlPlane(app.container.prisma);
  app.post("/superadmin/auth/login", async (req, reply) => {
    try { return await service().login(...Object.values(Login.parse(req.body)) as [string, string]); }
    catch { return reply.status(401).send({ title: "Invalid credentials", status: 401 }); }
  });
  app.post("/superadmin/auth/mfa/setup", async (req, reply) => { try { return await service().beginMfa(z.object({ token: z.string() }).parse(req.body).token); } catch { return reply.status(401).send({ title: "Invalid activation session", status: 401 }); } });
  app.post("/superadmin/auth/mfa/verify", async (req, reply) => { try { const body = Mfa.parse(req.body); return await service().completeMfa(body.token, body.code); } catch { return reply.status(401).send({ title: "Invalid authentication code", status: 401 }); } });

  await app.register(async secured => {
    secured.setErrorHandler((error, _req, reply) => {
      if (error instanceof z.ZodError) return reply.status(400).send({ title: "Validation failed", message: error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; "), status: 400 });
      return reply.status(400).send({ title: "Management action failed", message: error instanceof Error ? error.message : "The requested action could not be completed", status: 400 });
    });
    secured.addHook("preHandler", async (req, reply) => {
      const token = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : "";
      try { (req as FastifyRequest & { superAdmin: ReturnType<PlatformControlPlane["verifySession"]> }).superAdmin = service().verifySession(token); }
      catch { return reply.status(401).send({ title: "SuperAdmin authentication required", status: 401 }); }
    });
    const actor = (req: FastifyRequest) => (req as FastifyRequest & { superAdmin: ReturnType<PlatformControlPlane["verifySession"]> }).superAdmin;
    const meta = (req: FastifyRequest) => ({ ip: req.ip, userAgent: req.headers["user-agent"] });
    secured.get("/superadmin/overview", () => service().overview());
    secured.get("/superadmin/tenants", () => service().listTenants());
    secured.post("/superadmin/tenants", req => service().createTenant(actor(req), TenantCreate.parse(req.body), meta(req)));
    secured.patch("/superadmin/tenants/:id", req => service().updateTenant(actor(req), (req.params as { id: string }).id, TenantUpdate.parse(req.body), meta(req)));
    secured.delete("/superadmin/tenants/:id", async (req, reply) => { const body = z.object({ confirmation: z.string() }).parse(req.body); await service().deleteTenant(actor(req), (req.params as { id: string }).id, body.confirmation, meta(req)); return reply.status(204).send(); });
    secured.get("/superadmin/users", () => service().listUsers());
    secured.post("/superadmin/users", req => service().createUser(actor(req), UserCreate.parse(req.body), meta(req)));
    secured.patch("/superadmin/users/:id", req => service().updateUser(actor(req), (req.params as { id: string }).id, UserUpdate.parse(req.body), meta(req)));
    secured.delete("/superadmin/users/:id", async (req, reply) => { await service().deleteUser(actor(req), (req.params as { id: string }).id, meta(req)); return reply.status(204).send(); });
    secured.get("/superadmin/configurations", () => service().listConfigurations());
    secured.put("/superadmin/configurations", req => service().upsertConfiguration(actor(req), Config.parse(req.body), meta(req)));
    secured.post("/superadmin/configurations/:id/test", req => service().testConfiguration(actor(req), (req.params as { id: string }).id, meta(req)));
    secured.delete("/superadmin/configurations/:id", async (req, reply) => { await service().deleteConfiguration(actor(req), (req.params as { id: string }).id, meta(req)); return reply.status(204).send(); });
    secured.get("/superadmin/audit", () => service().listAudit());
    secured.get("/superadmin/system", async () => ({ api: "UP", database: "UP", kestra: await fetch(process.env.KESTRA_HEALTH_URL ?? "http://127.0.0.1:8094/health").then(r => r.ok ? "UP" : "DOWN").catch(() => "DOWN"), workers: await fetch(process.env.WORKERS_HEALTH_URL ?? "http://127.0.0.1:8092/ready").then(r => r.ok ? "UP" : "DOWN").catch(() => "DOWN") }));

    // Kestra orchestration inventory for the SuperAdmin portal. The plugin/flow
    // catalog is declarative (it reflects what DonorDesk provisions and deploys,
    // not a live Kestra plugin registry). Live health is checked against the
    // loopback Kestra + workers endpoints. `deployed` is intentionally NOT
    // asserted here: an integration is only operational after the flow is
    // actually deployed and a production execution succeeds (see
    // memorybank/SUPERADMIN-PORTAL.md §12).
    secured.get("/superadmin/kestra", async () => {
      const health = async (url: string) => fetch(url).then(r => (r.ok ? "UP" : "DOWN")).catch(() => "DOWN");
      const [kestra, workers] = await Promise.all([
        health(process.env.KESTRA_HEALTH_URL ?? "http://127.0.0.1:8094/health"),
        health(process.env.WORKERS_HEALTH_URL ?? "http://127.0.0.1:8092/ready"),
      ]);
      const plugins = [
        { id: "tika", name: "Apache Tika", category: "Parsing", purpose: "Document text and OCR extraction for evidence", flow: "evidence_parse", free: true },
        { id: "redis", name: "Redis", category: "Caching", purpose: "Tenant-scoped caching and TTL keys", flow: "period_cache", free: true },
        { id: "jdbc-postgres", name: "JDBC PostgreSQL", category: "Data", purpose: "Read-only analytics queries against the app database", flow: "analytics_snapshot", free: true },
        { id: "gdrive", name: "Google Drive", category: "Ingestion", purpose: "Inbound evidence ingestion from a Drive folder", flow: "gdrive_ingest", free: true },
        { id: "sftp", name: "SFTP", category: "Ingestion", purpose: "Inbound evidence ingestion from an SFTP drop folder", flow: "sftp_ingest", free: true },
      ];
      const flows = plugins.map(p => ({ id: p.flow, plugin: p.id, gated: p.id === "gdrive" || p.id === "sftp" }));
      return { kestra, workers, plugins, flows };
    });
  });
}
