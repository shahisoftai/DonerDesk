import { ConversionRelay } from "@/features/analytics/presentation/ConversionRelay";
import { resolveWelcome } from "@/features/analytics/domain/events";

type Params = Record<string, string | string[] | undefined>;
const word = (value: string | string[] | undefined): string | undefined => (typeof value === "string" ? value : undefined);

/** The moment after sign-up where the sign-up event is sent. It forwards to the app at once, with or without JavaScript. */
export default async function WelcomePage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const welcome = resolveWelcome({ kind: word(params.kind), to: word(params.to), plan: word(params.plan) });
  return (
    <main className="mx-auto mt-24 max-w-md px-6 text-center">
      <meta httpEquiv="refresh" content={`3;url=${welcome.next}`} />
      <p className="text-sm text-slate-600 dark:text-slate-400">Setting up your workspace…</p>
      <p className="mt-3 text-sm">
        <a className="link" href={welcome.next}>Continue</a>
      </p>
      <ConversionRelay welcome={welcome} />
    </main>
  );
}
