import type { ReactNode } from "react";
import { requireSession, hasCapability } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { OrganizationProfileSchema } from "@/lib/server/schemas";
import { Tabs } from "@/components/data/Tabs";

export const dynamic = "force-dynamic";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const ctx = await requireSession();

  const tabs: Array<{ label: string; href: string }> = [];
  if (hasCapability(ctx, "project.create")) {
    tabs.push({ label: "Setup", href: "/settings/setup" });
  }
  tabs.push({ label: "Settings", href: "/settings" });
  tabs.push({ label: "Security", href: "/settings/security" });
  if (hasCapability(ctx, "audit.view")) {
    tabs.push({ label: "Audit log", href: "/settings/audit" });
  }
  // Agent Memory (Phase 21) — hidden unless the viewer can manage it AND the
  // platform rollout flag is on; there is nothing to configure otherwise.
  if (hasCapability(ctx, "report.manage-agent-memory")) {
    const org = await gatewayRequest("/v1/organization", OrganizationProfileSchema, ctx.token);
    if (org.ok && org.value.agentMemoryPlatformEnabled) {
      tabs.push({ label: "AI Writing Style", href: "/settings/ai-style" });
    }
  }

  return (
    <div>
      <Tabs items={tabs} label="Workspace setup, settings, and audit" />
      <div className="mt-6">{children}</div>
    </div>
  );
}
