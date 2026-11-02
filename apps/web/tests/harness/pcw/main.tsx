import { useState } from "react";
import { createRoot } from "react-dom/client";
import { PcwShell } from "@/features/project-setup/pcw/presentation/PcwShell";
import { getDraftAction } from "@/lib/actions/project-setup-draft";
import { I18nProvider } from "@/features/i18n/presentation/I18nProvider";
import { reset, store, view } from "./stubs/state";

const h = { store, reset, view, navigate: (_url: string) => undefined as void };
(window as unknown as { __h: unknown }).__h = h;

function Host() {
  const [initial, setInitial] = useState<ReturnType<typeof view> | null>(null);
  const [key, setKey] = useState(0);
  // The app's page remounts the wizard for a new draft; the harness does the same when asked to go to one.
  h.navigate = () => { setInitial(null); setKey((k) => k + 1); };
  if (!initial) { void getDraftAction("draft-1").then((r) => r.ok && setInitial(r.value as never)); return <p>Loading…</p>; }
  return <PcwShell key={key} id="draft-1" initial={initial as never} />;
}
const lang = new URLSearchParams(window.location.search).get("lang");
const initialLocale = lang === "fr" || lang === "es" || lang === "ar" ? lang : "en";
createRoot(document.getElementById("root")!).render(<I18nProvider initialLocale={initialLocale}><Host /></I18nProvider>);
