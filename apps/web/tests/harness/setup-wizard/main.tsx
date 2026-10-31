import { useState } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "@/features/i18n/presentation/I18nProvider";
import { SetupWizard } from "@/features/project-setup/presentation/SetupWizard";
import { finishReading, fixture, viewOf } from "./stubs/actions";

type Route = { id: string | null; s: string | null };
const params = new URLSearchParams(window.location.search);
const lang = (["en", "fr", "es", "ar"].includes(params.get("lang") ?? "") ? params.get("lang") : "en") as "en" | "fr" | "es" | "ar";

const h = { calls: [], store: new Map(), refresh: () => undefined, navigate: (_u: string) => undefined, refreshes: 0, fixtures: () => fixture(true), flags: { planFails: false }, finishReading, viewOf } as Record<string, unknown>;
(window as unknown as { __h: unknown }).__h = h;

function Host() {
  const [, setTick] = useState(0);
  const [route, setRoute] = useState<Route>({ id: null, s: params.get("s") });
  h.refresh = () => setTick((t) => t + 1);
  h.navigate = (url: string) => {
    const match = /\/document\/([^/?]+)/.exec(url);
    setRoute({ id: match ? decodeURIComponent(match[1]!) : null, s: new URL(url, "http://x").searchParams.get("s") });
  };
  const stored = route.id ? (h.store as Map<string, never>).get(route.id) : null;
  const view = stored ? viewOf(stored) : null;
  return (
    <I18nProvider initialLocale={lang}>
      <SetupWizard key={route.id ?? "new"} view={view as never} recent={[]} asked={route.s} />
    </I18nProvider>
  );
}
createRoot(document.getElementById("root")!).render(<Host />);
