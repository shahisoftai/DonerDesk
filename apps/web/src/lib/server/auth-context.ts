import "server-only";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSessionToken } from "@/lib/session-server";
import { decodeSessionPayload } from "@/lib/shared/jwt-session";
import { capabilitiesForRole, can, type Capability } from "@/lib/shared/capabilities";

export type AuthContext = {
  token: string;
  role: string | null;
  capabilities: ReadonlySet<Capability>;
};

export async function requireSession(): Promise<AuthContext> {
  const token = await getSessionToken();
  if (!token) {
    redirect("/login?next=" + encodeURIComponent(await currentPath()));
  }
  const payload = decodeSessionPayload(token);
  const role = payload?.role ?? null;
  return { token, role, capabilities: capabilitiesForRole(role ?? undefined) };
}

async function currentPath(): Promise<string> {
  const header = await headers();
  const pathname = header.get("x-pathname");
  if (pathname) return pathname;
  const url = header.get("x-url");
  if (url) {
    try {
      return new URL(url).pathname + new URL(url).search;
    } catch {
      return "/dashboard";
    }
  }
  return "/dashboard";
}

export function hasCapability(context: AuthContext, capability: Capability): boolean {
  return can(context.capabilities, capability);
}
