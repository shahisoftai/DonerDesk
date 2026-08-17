import type { ReactNode } from "react";
import { requireSession, hasCapability } from "@/lib/server/auth-context";
import { Tabs } from "@/components/data/Tabs";

export const dynamic = "force-dynamic";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const ctx = await requireSession();

  const tabs: Array<{ label: string; href: string }> = [];
  if (hasCapability(ctx, "project.create")) {
    tabs.push({ label: "Setup", href: "/settings/setup" });
  }
  tabs.push({ label: "Settings", href: "/settings" });
  if (hasCapability(ctx, "audit.view")) {
    tabs.push({ label: "Audit log", href: "/settings/audit" });
  }

  return (
    <div>
      <Tabs items={tabs} label="Workspace setup, settings, and audit" />
      <div className="mt-6">{children}</div>
    </div>
  );
}
