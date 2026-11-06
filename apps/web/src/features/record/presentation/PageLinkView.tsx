"use client";

import Link from "next/link";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import type { KindViewProps } from "./KindView";

/**
 * A kind whose own form is opened on its existing page: the sheet still starts the record, one tap takes the person to it. Used only
 * by kinds that have no form inside the sheet yet.
 */
export function pageLinkView(href: (projectId: string) => string) {
  return function PageLinkView({ kind, projectId, onClose }: KindViewProps) {
    const { t } = useI18n();
    return (
      <>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">{t(kind.hintKey)}</p>
        <Link className="btn-primary min-h-[52px] w-full text-base" href={href(projectId)} prefetch={false} onClick={onClose}>{t(kind.labelKey)}</Link>
      </>
    );
  };
}
