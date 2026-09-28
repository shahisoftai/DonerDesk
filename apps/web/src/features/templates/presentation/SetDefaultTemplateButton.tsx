"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { setTemplateDefaultAction } from "@/lib/actions/templates";

/**
 * Toggles whether a template is its project's default (the one new reporting
 * periods pre-select). Only rendered when the project has more than one
 * template — with a single template it is always the effective default, so
 * there is nothing to choose between.
 */
export function SetDefaultTemplateButton({ templateId, isDefault }: { templateId: string; isDefault: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    setError(null);
    const result = await setTemplateDefaultAction(templateId, !isDefault);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message ?? "Could not update the default template.");
      return;
    }
    router.refresh();
  }

  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      {isDefault ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          pending={busy}
          onClick={toggle}
          className="border-success-500/50 text-success-700 hover:border-success-500 hover:text-success-800 dark:text-success-400"
          title="Stop using this template as the project default"
        >
          ✓ Default
        </Button>
      ) : (
        <Button type="button" size="sm" variant="ghost" pending={busy} onClick={toggle} title="Use this template as the project default for new reporting periods">
          Set as default
        </Button>
      )}
      {error && <span className="text-xs text-danger-600 dark:text-danger-400">{error}</span>}
    </span>
  );
}
