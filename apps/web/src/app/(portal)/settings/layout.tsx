import type { ReactNode } from "react";
import { requireSession, hasCapability } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { OrganizationProfileSchema } from "@/lib/server/schemas";
import { SettingsNav, type SettingsGroup } from "@/features/settings/presentation/SettingsNav";

export const dynamic = "force-dynamic";

/**
 * Settings (Version 4.000, plan F28/F29): one grouped list on the side instead of a row of eleven tabs. A page the person cannot
 * use is not listed; a group with nothing in it is not shown.
 */
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const ctx = await requireSession();
  const can = (c: Parameters<typeof hasCapability>[1]) => hasCapability(ctx, c);
  let aiStyle = false;
  if (can("report.manage-agent-memory")) {
    const org = await gatewayRequest("/v1/organization", OrganizationProfileSchema, ctx.token);
    aiStyle = org.ok && Boolean(org.value.agentMemoryPlatformEnabled);
  }
  const groups: SettingsGroup[] = [
    { label: "Organisation", items: [
      { label: "General", href: "/settings" },
      ...(can("project.create") ? [{ label: "Workspace setup", href: "/settings/setup" }] : []),
      ...(can("org.manage") ? [{ label: "Finance", href: "/settings/finance" }] : []),
    ] },
    { label: "Data defaults", items: [
      ...(can("org.manage") ? [{ label: "Starting answers", href: "/settings/setup-packs" }, { label: "Sector library", href: "/settings/sector-library" }] : []),
      ...(can("template.edit") ? [{ label: "Donor requirements", href: "/settings/requirement-packs" }] : []),
    ] },
    { label: "AI", items: [
      { label: "AI features", href: "/settings/ai" },
      ...(can("org.manage") ? [{ label: "AI usage", href: "/settings/ai-usage" }] : []),
      ...(aiStyle ? [{ label: "Writing style", href: "/settings/ai-style" }] : []),
    ] },
    { label: "Security", items: [
      { label: "Sign-in and two-step", href: "/settings/security" },
      ...(can("audit.view") ? [{ label: "Audit log", href: "/settings/audit" }] : []),
    ] },
    { label: "Billing", items: [{ label: "Plan and billing", href: "/settings/billing" }] },
    { label: "Integrations", items: [...(can("org.manage") ? [{ label: "API keys and webhooks", href: "/settings/integrations" }] : [])] },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="mx-auto grid w-full max-w-[1280px] gap-8 lg:grid-cols-[13.5rem_minmax(0,1fr)]">
      <SettingsNav groups={groups} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
