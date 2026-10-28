"use client";

import { useRef } from "react";
import type { FormField } from "@donordesk/domain/contexts/collection/index.js";
import { newIdempotencyKey } from "@/lib/shared/create-retry";
import { FormFiller } from "./FormFiller";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { LocaleSwitcher } from "@/features/i18n/presentation/LocaleSwitcher";

/** The public form. Each answer carries its own id, kept until it is sent, so a repeated send after a bad connection is stored once. */
export function PublicCollectForm({ token, fields }: { token: string; fields: ReadonlyArray<FormField> }) {
  const key = useRef(newIdempotencyKey());
  const { t } = useI18n();
  return (
    <>
    <div className="mb-4 flex justify-end"><LocaleSwitcher /></div>
    <FormFiller
      fields={fields}
      withName
      uploadFile={async (file) => {
        const body = new FormData();
        body.set("file", file);
        try {
          const response = await fetch(`/api/collect/${encodeURIComponent(token)}/files`, { method: "POST", body });
          const json = (await response.json().catch(() => null)) as { id?: string; name?: string; title?: string; detail?: string } | null;
          if (response.ok && json?.id) return { ok: true, id: json.id, name: json.name ?? file.name };
          return { ok: false, message: response.status === 404 ? t("collect.linkGone") : json?.detail ?? json?.title ?? t("collect.sendFailed") };
        } catch {
          return { ok: false, message: t("collect.noConnection") };
        }
      }}
      submitLabel={t("form.sendMyAnswers")}
      onSubmit={async (answers, submitterName) => {
        try {
          const id = key.current.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60).padEnd(8, "0");
          const response = await fetch(`/api/collect/${encodeURIComponent(token)}`, {
            method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, answers, ...(submitterName ? { submitterName } : {}) }),
          });
          if (response.ok) { key.current = newIdempotencyKey(); return { ok: true }; }
          if (response.status === 404) return { ok: false, message: t("collect.linkGone") };
          const problem = (await response.json().catch(() => null)) as { title?: string; detail?: string } | null;
          return { ok: false, message: problem?.detail ?? problem?.title ?? t("collect.sendFailed") };
        } catch {
          return { ok: false, message: t("collect.noConnection") };
        }
      }}
    />
    </>
  );
}
