import type { ReactNode } from "react";
import { can, type Capability } from "@/lib/shared/capabilities";

export function PermissionGate({
  capabilities,
  capability,
  children,
  fallback = null,
}: {
  capabilities: ReadonlySet<Capability> | readonly Capability[];
  capability: Capability;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  if (!can(capabilities, capability)) return fallback;
  return children;
}
