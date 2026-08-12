import { PrismaClient } from "@prisma/client";

export interface ReplicaConfig {
  url: string;
  role?: string;
}

export interface ReadReplicaRoutingOptions {
  primaryUrl: string;
  replicas: ReplicaConfig[];
  tenantId: string;
}

export function withTenantSession(databaseUrl: string, tenantId: string): string {
  if (!/^[A-Za-z0-9_-]{3,128}$/.test(tenantId)) throw new Error("Invalid tenant identifier");
  const url = new URL(databaseUrl);
  url.searchParams.set("options", `-c app.current_tenant=${tenantId} -c application_name=donordesk:${tenantId}`);
  return url.toString();
}

export class ReplicaRouter {
  private readonly primary: PrismaClient;
  private readonly replicas: Array<{ client: PrismaClient; role?: string }>;
  private readonly tenantId: string;
  private replicaIndex = 0;

  constructor(options: ReadReplicaRoutingOptions) {
    const primaryUrl = withTenantSession(options.primaryUrl, options.tenantId);
    this.primary = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? (["warn", "error"] as const) : (["error"] as const),
      datasources: { db: { url: primaryUrl } },
    });
    this.replicas = options.replicas.map((r) => ({
      client: new PrismaClient({
        datasources: { db: { url: withTenantSession(r.url, options.tenantId) } },
      }),
      role: r.role,
    }));
    this.tenantId = options.tenantId;
  }

  get primaryClient(): PrismaClient {
    return this.primary;
  }

  getReadClient(): PrismaClient {
    if (this.replicas.length === 0) {
      return this.primary;
    }
    const idx = this.replicaIndex % this.replicas.length;
    this.replicaIndex++;
    return this.replicas[idx]!.client;
  }

  async useReadReplica<T>(fn: (client: PrismaClient) => Promise<T>): Promise<T> {
    const client = this.getReadClient();
    return fn(client);
  }

  async usePrimary<T>(fn: (client: PrismaClient) => Promise<T>): Promise<T> {
    return fn(this.primary);
  }

  async disconnect(): Promise<void> {
    await this.primary.$disconnect();
    await Promise.all(this.replicas.map((r) => r.client.$disconnect()));
  }
}

export function createReplicaRouter(options: ReadReplicaRoutingOptions): ReplicaRouter {
  return new ReplicaRouter(options);
}

export class TenantAwareConnectionPool {
  private readonly routers: Map<string, ReplicaRouter> = new Map();
  private readonly defaultPrimaryUrl: string;
  private readonly defaultReplicaUrls: ReplicaConfig[];

  constructor(defaultPrimaryUrl: string, defaultReplicaUrls: ReplicaConfig[] = []) {
    this.defaultPrimaryUrl = defaultPrimaryUrl;
    this.defaultReplicaUrls = defaultReplicaUrls;
  }

  getRouter(tenantId: string): ReplicaRouter {
    let router = this.routers.get(tenantId);
    if (!router) {
      router = new ReplicaRouter({
        primaryUrl: this.defaultPrimaryUrl,
        replicas: this.defaultReplicaUrls,
        tenantId,
      });
      this.routers.set(tenantId, router);
    }
    return router;
  }

  async disconnectAll(): Promise<void> {
    await Promise.all(Array.from(this.routers.values()).map((r) => r.disconnect()));
    this.routers.clear();
  }
}
