import type { Metadata } from "next";
import Link from "next/link";
import { CookieConsentBanner } from "@/components/legal/CookieConsentBanner";
import { MarketingNav } from "@/components/landing/MarketingNav";
import { MarketingFooter } from "@/components/landing/MarketingFooter";
import { FEATURE_GROUPS } from "@/components/landing/platform-content";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Every DonorDesk module: logframe and indicators, activity capture, the Data Center, evidence, team roles, donor templates, sourced AI drafting, compliance checks, approval and exports, with the limits stated.",
  alternates: { canonical: "/features" },
};

export default function FeaturesPage() {
  const allFeatures = FEATURE_GROUPS.flatMap((g) => g.features);

  return (
    <main className="landing-tech min-h-screen overflow-x-hidden bg-slate-950 text-slate-100">
      <MarketingNav />

      <section className="relative isolate px-6 pb-16 pt-20 sm:pt-28">
        <div aria-hidden className="tech-orb tech-orb-left" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_-10%,rgba(12,141,230,0.30),transparent)]"
        />
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-brand-300">Features</p>
          <h1 className="mt-4 text-5xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-6xl">
            The programme, and the report it produces
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">
            DonorDesk is a working system for grant-funded programmes. You run the logframe, record activities, keep the
            evidence and track compliance. Donor reports are drafted from that record, checked against it, and approved by a
            person. Each feature below says what it does, who uses it, and what to know before you rely on it.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-7 py-3.5 text-base font-semibold text-white shadow-xl shadow-brand-500/40 transition hover:from-brand-400 hover:to-brand-500 sm:w-auto"
            >
              Create a free workspace
            </Link>
            <Link
              href="/tour"
              className="inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-white/5 px-7 py-3.5 text-base font-semibold text-white transition hover:bg-white/10 sm:w-auto"
            >
              Take the product tour
            </Link>
          </div>
        </div>
      </section>

      {/* Jump list */}
      <nav aria-label="Jump to a feature" className="border-y border-white/10 bg-white/[0.025] px-6 py-6">
        <ul className="mx-auto flex max-w-7xl flex-wrap justify-center gap-2">
          {allFeatures.map((f) => (
            <li key={f.id}>
              <a
                href={`#${f.id}`}
                className="inline-block rounded-full border border-brand-400/20 bg-brand-400/[0.07] px-4 py-2 text-xs font-semibold text-brand-200 transition hover:border-brand-400/50 hover:text-white"
              >
                {f.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {FEATURE_GROUPS.map((group) => (
        <section key={group.id} aria-labelledby={`group-${group.id}`} className="px-6 py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-bold uppercase tracking-widest text-brand-300">{group.eyebrow}</p>
              <h2 id={`group-${group.id}`} className="mt-3 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                {group.title}
              </h2>
              <p className="mt-4 text-lg text-slate-300">{group.intro}</p>
            </div>

            <div className="mt-16 space-y-6">
              {group.features.map((f) => (
                <article
                  key={f.id}
                  id={f.id}
                  className="scroll-mt-28 rounded-2xl border border-white/10 bg-white/[0.03] p-7 sm:p-9"
                >
                  <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
                    <div>
                      <h3 className="text-2xl font-bold text-white">{f.title}</h3>
                      <p className="mt-3 text-base leading-relaxed text-slate-300">{f.summary}</p>
                      <p className="mt-5 text-sm text-slate-400">
                        <span className="font-semibold text-slate-300">Who uses it:</span> {f.who}
                      </p>
                      <Link
                        href={f.supportHref}
                        className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand-300 transition hover:text-brand-200"
                      >
                        Step-by-step guide <span aria-hidden>→</span>
                      </Link>
                    </div>
                    <div>
                      <p className="text-sm font-bold uppercase tracking-widest text-cyan-300/80">In practice</p>
                      <ul className="mt-3 space-y-3 text-sm leading-relaxed text-slate-300">
                        {f.inPractice.map((point) => (
                          <li key={point} className="flex gap-3">
                            <span aria-hidden className="mt-0.5 text-brand-400">✓</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-6 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-amber-300">Good to know</p>
                        <p className="mt-2 text-sm leading-relaxed text-slate-300">{f.goodToKnow}</p>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="px-6 pb-24">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-brand-400/30 bg-gradient-to-br from-brand-600 via-brand-700 to-slate-900 px-6 py-16 text-center">
          <h2 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">See it on your own programme</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-brand-100">
            Start a free workspace, or take the narrated tour first. The demo project is included, and it uses no AI credits.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex w-full items-center justify-center rounded-xl bg-white px-7 py-3.5 font-bold text-brand-700 shadow-xl transition hover:bg-brand-50 sm:w-auto"
            >
              Get started free
            </Link>
            <Link
              href="/pricing"
              className="inline-flex w-full items-center justify-center rounded-xl border border-white/30 px-7 py-3.5 font-semibold text-white transition hover:bg-white/10 sm:w-auto"
            >
              Compare plans
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
      <CookieConsentBanner />
    </main>
  );
}
