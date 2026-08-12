import type { ReactNode } from "react";
import { requireSession, hasCapability } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { OrganizationSchema, NotificationsResponseSchema } from "@/lib/server/schemas";
import { decodeSessionPayload } from "@/lib/shared/jwt-session";
import { AppShell } from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/feedback/Toast";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const ctx = await requireSession();

  const [orgResult, notificationsResult] = await Promise.all([
    gatewayRequest("/v1/organization", OrganizationSchema, ctx.token),
    gatewayRequest("/v1/notifications", NotificationsResponseSchema, ctx.token),
  ]);

  const orgName = orgResult.ok ? (orgResult.value.name ?? "") : "";
  const identity = decodeSessionPayload(ctx.token);
  const user = { name: identity?.name ?? "", email: identity?.email ?? "" };
  const bellItems = (notificationsResult.ok ? notificationsResult.value.items : []).map((n) => ({
    id: n.id,
    title: n.title ?? "",
    read: n.read ?? false,
  }));

  const navItems: Array<{ href: string; label: string }> = [{ href: "/dashboard", label: "Home" }, { href: "/my-work", label: "My Work" }];
  if (hasCapability(ctx, "project.create")) {
    navItems.push({ href: "/onboarding", label: "Setup" });
  }
  navItems.push({ href: "/projects", label: "Projects" });
  navItems.push({ href: "/notifications", label: "Notifications" });
  if (hasCapability(ctx, "team.manage") || hasCapability(ctx, "team.invite")) {
    navItems.push({ href: "/team", label: "Team" });
  }
  if (hasCapability(ctx, "audit.view")) {
    navItems.push({ href: "/audit", label: "Audit log" });
  }
  if (hasCapability(ctx, "settings.view") || hasCapability(ctx, "org.manage")) {
    navItems.push({ href: "/settings", label: "Settings" });
  }

  return (
    <ToastProvider>
      <AppShell
        orgName={orgName}
        user={user}
        navItems={navItems}
        canCreate={hasCapability(ctx, "project.create")}
        bellItems={bellItems}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
