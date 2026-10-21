import type { ReactNode } from "react";
import { NOINDEX_METADATA } from "@/lib/seo";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireSession, hasCapability } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { OrganizationSchema, NotificationsResponseSchema, LegalConsentSchema } from "@/lib/server/schemas";
import { decodeSessionPayload } from "@/lib/shared/jwt-session";
import { AppShell } from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/feedback/Toast";
import { TourOverlay } from "@/features/tour/presentation/TourOverlay";
import { OutboxProvider } from "@/features/offline/presentation/OutboxProvider";
import { OutboxBanner } from "@/features/offline/presentation/OutboxBanner";

export const dynamic = "force-dynamic";
export const metadata = NOINDEX_METADATA;

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const ctx = await requireSession();

  const [orgResult, notificationsResult, consentResult] = await Promise.all([
    gatewayRequest("/v1/organization", OrganizationSchema, ctx.token),
    gatewayRequest("/v1/notifications", NotificationsResponseSchema, ctx.token),
    gatewayRequest("/v1/legal/consent", LegalConsentSchema, ctx.token),
  ]);

  // Terms-of-Reference consent gate: until the user accepts the Terms of
  // Service and Privacy Policy during onboarding, only the onboarding flow
  // and logout are reachable.
  if (consentResult.ok && !consentResult.value.accepted) {
    const header = await headers();
    const pathname = header.get("x-pathname") ?? "";
    const allowed = pathname.startsWith("/onboarding") || pathname.startsWith("/logout");
    if (!allowed) {
      redirect("/onboarding");
    }
  }

  const orgName = orgResult.ok ? (orgResult.value.name ?? "") : "";
  const identity = decodeSessionPayload(ctx.token);
  const user = { name: identity?.name ?? "", email: identity?.email ?? "" };
  const bellItems = (notificationsResult.ok ? notificationsResult.value.items : []).map((n) => ({
    id: n.id,
    title: n.title ?? "",
    read: n.read ?? false,
  }));

  // An outside partner sees only their projects: every other page would answer "not part of your account".
  const navItems: Array<{ href: string; label: string }> = ctx.external ? [{ href: "/projects", label: "My projects" }] : [{ href: "/dashboard", label: "Home" }, { href: "/my-work", label: "My Work" }];
  if (!ctx.external) navItems.push({ href: "/projects", label: "Projects" });
  if (!ctx.external) {
    navItems.push({ href: "/reports", label: "Reports" });
    navItems.push({ href: "/downloads", label: "Download Center" });
    navItems.push({ href: "/evidence", label: "Evidence" });
    navItems.push({ href: "/compliance", label: "Compliance" });
  }
  if (!ctx.external && (hasCapability(ctx, "team.manage") || hasCapability(ctx, "team.invite"))) {
    navItems.push({ href: "/team", label: "Team" });
  }
  if (
    !ctx.external && (
    hasCapability(ctx, "project.create") ||
    hasCapability(ctx, "audit.view") ||
    hasCapability(ctx, "settings.view") ||
    hasCapability(ctx, "org.manage"))
  ) {
    navItems.push({ href: "/settings", label: "Settings" });
  }

  return (
    <ToastProvider>
      <OutboxProvider scope={identity?.sub ?? user.email ?? "user"}>
      <AppShell
        orgName={orgName}
        user={user}
        navItems={navItems}
        canCreate={hasCapability(ctx, "project.create")}
        bellItems={bellItems}
      >
        {children}
      </AppShell>
      <TourOverlay />
      <OutboxBanner />
      </OutboxProvider>
    </ToastProvider>
  );
}
