"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { setTemplateDefaultForTypeAction } from "@/lib/actions/templates";

/** One button per report type this template may structure: "Make default for Monthly" / "Default for Monthly". */
export function TemplateTypeDefaults({ templateId, types, canEdit }: { templateId: string; types: Array<{ type: string; label: string; isDefault: boolean }>; canEdit: boolean }) {
  const router = useRouter();
  const [busyType, setBusyType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!canEdit || types.length === 0) return null;

  async function toggle(type: string, isDefault: boolean) {
    setBusyType(type);
    setError(null);
    const result = await setTemplateDefaultForTypeAction(templateId, type, isDefault);
    setBusyType(null);
    if (!result.ok) return setError(result.error.message);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {types.map((t) => (
        <Button key={t.type} size="sm" variant={t.isDefault ? "secondary" : "ghost"} pending={busyType === t.type} onClick={() => void toggle(t.type, !t.isDefault)} title={t.isDefault ? `Stop using this template by default for ${t.label.toLowerCase()} reports` : `Use this template for new ${t.label.toLowerCase()} reports`}>
          {t.isDefault ? `✓ Default for ${t.label}` : `Make default for ${t.label}`}
        </Button>
      ))}
      {error && <span role="alert" className="text-xs text-danger-600 dark:text-danger-400">{error}</span>}
    </div>
  );
}
