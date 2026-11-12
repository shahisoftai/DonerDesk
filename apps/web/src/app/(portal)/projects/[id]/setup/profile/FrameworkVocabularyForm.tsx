"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { setFrameworkVocabularyAction } from "@/lib/actions/setup";
import { useHydrated } from "@/lib/client/use-hydrated";
import { DEFAULT_VOCABULARY, VOCABULARY_PRESETS, presetKeyOf, presetVocabulary, type FrameworkVocabulary } from "@donordesk/domain/contexts/logframe/framework-vocabulary.js";
import { LOGFRAME_LEVEL_OPTIONS } from "@/lib/labels";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";

const CUSTOM = "CUSTOM";

/** What the donor calls the levels of the results chain. Only the words shown change; nothing stored does. */
export function FrameworkVocabularyForm({ projectId, initial }: { projectId: string; initial?: FrameworkVocabulary | undefined }) {
  const router = useRouter();
  const { t } = useI18n();
  const hydrated = useHydrated();
  const start = initial ?? DEFAULT_VOCABULARY;
  const [preset, setPreset] = useState<string>(presetKeyOf(start));
  const [vocabulary, setVocabulary] = useState<FrameworkVocabulary>(start);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function choose(key: string) {
    setPreset(key);
    setSaved(false);
    const words = presetVocabulary(key);
    if (words) setVocabulary(words);
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const result = await setFrameworkVocabularyAction(projectId, vocabulary);
    setBusy(false);
    if (!result.ok) return setError(result.error.message);
    setSaved(true);
    router.refresh();
  }

  const custom = preset === CUSTOM;
  return (
    <section className="card" aria-labelledby="framework-vocabulary-heading">
      <h3 id="framework-vocabulary-heading" className="text-sm font-medium">{t("framework.wording.title")}</h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {t("framework.wording.help")}
      </p>
      <label className="mt-3 block text-sm">
        <span className="mb-1 block">{t("framework.wording.preset")}</span>
        <Select value={preset} disabled={busy || !hydrated} onChange={(e) => choose(e.target.value)}>
          {VOCABULARY_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label} ({p.vocabulary.document})</option>)}
          <option value={CUSTOM}>{t("framework.wording.custom")}</option>
        </Select>
      </label>
      {custom && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block">{t("framework.wording.document")}</span>
            <Input value={vocabulary.document} maxLength={40} onChange={(e) => { setSaved(false); setVocabulary({ ...vocabulary, document: e.target.value }); }} />
          </label>
          {LOGFRAME_LEVEL_OPTIONS.map((level) => (
            <label key={level} className="block text-sm">
              <span className="mb-1 block">{t("framework.wording.levelCalled", { level: DEFAULT_VOCABULARY.levels[level as keyof FrameworkVocabulary["levels"]] })}</span>
              <Input value={vocabulary.levels[level as keyof FrameworkVocabulary["levels"]]} maxLength={40} onChange={(e) => { setSaved(false); setVocabulary({ ...vocabulary, levels: { ...vocabulary.levels, [level]: e.target.value } }); }} />
            </label>
          ))}
        </div>
      )}
      <div className="mt-3"><Button size="sm" onClick={() => void save()} pending={busy} disabled={!hydrated}>{t("framework.wording.save")}</Button></div>
      {saved && <p role="status" className="mt-2 text-sm text-success-700 dark:text-success-400">{t("framework.wording.saved")}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-danger-700 dark:text-danger-400">{error}</p>}
    </section>
  );
}
