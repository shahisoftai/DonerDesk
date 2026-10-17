import Link from "next/link";
import Image from "next/image";
import Script from "next/script";
import { CookieConsentBanner } from "@/components/legal/CookieConsentBanner";
import { HomeFaq } from "@/components/landing/HomeFaq";
import { ProductProofStrip } from "@/components/landing/ProductProofStrip";
import { MarketingNav } from "@/components/landing/MarketingNav";
import { MarketingFooter } from "@/components/landing/MarketingFooter";
import { RUN_MODULES, REPORT_MODULES, type ModuleCard } from "@/components/landing/platform-content";

// The record, from plan to report. Each stage is a step the programme already takes.
const RECORD_STAGES = [
  {
    step: "01",
    icon: "◫",
    title: "Plan",
    description: "Set up the logframe, indicators, baselines and targets. Import what you already have.",
  },
  {
    step: "02",
    icon: "✎",
    title: "Record",
    description: "Field staff log activities as they happen, typed or dictated. Indicator values are entered once per period.",
  },
  {
    step: "03",
    icon: "✓",
    title: "Check",
    description: "Link evidence to the activities it proves. The checklist shows what is missing and what closes it.",
  },
  {
    step: "04",
    icon: "⇪",
    title: "Report",
    description: "The donor template structures the report. Drafts cite their sources. A person approves before export.",
  },
];

const HOW_STEPS = [
  { step: "1", title: "Set up the project", description: "Define the programme, reporting profile, dates, funder and team." },
  { step: "2", title: "Build the logframe", description: "Add goals, outcomes, outputs and activities, and the indicators that measure them." },
  { step: "3", title: "Record as you go", description: "Activities, indicator values and evidence are logged by the people doing the work." },
  { step: "4", title: "Watch the readiness", description: "The checklist and readiness score show gaps and what closes each one, weeks before the deadline." },
  { step: "5", title: "Draft and approve", description: "Drafts follow the donor template and cite their sources. Approvers sign off each section." },
  { step: "6", title: "Export and submit", description: "Download Word, PDF, Excel or ZIP and send it to the donor yourself." },
];

const SECTORS = ["Health", "Nutrition", "WASH", "Protection", "Education", "Livelihoods", "Shelter", "Food security", "Climate"];

const AUDIENCES = [
  {
    icon: "◎",
    title: "Humanitarian & development",
    description: "Local and international NGOs running several grants at once, with field teams and donor templates to satisfy.",
  },
  {
    icon: "◈",
    title: "Research & public health",
    description: "Programmes where results must be evidenced, sometimes for ministries, universities and public agencies.",
  },
  {
    icon: "◇",
    title: "Government-funded programmes",
    description: "Units that deliver a programme and report it up to a funder, with approvals and an audit trail.",
  },
  {
    icon: "◐",
    title: "Education & skills",
    description: "Training and employment programmes that track cohorts, activities and outcomes across periods.",
  },
  {
    icon: "◉",
    title: "Climate & social impact",
    description: "Projects that must show progress against a results framework and document what changed.",
  },
];

const SECURITY = [
  {
    title: "Tenant isolation",
    description: "Row-level security in the database keeps each organisation's data separate from every other.",
  },
  {
    title: "Hash-chained audit log",
    description: "Changes are recorded in a log where each entry is chained to the one before, so edits to history are detectable.",
  },
  {
    title: "Reviewable AI",
    description: "Model, prompt version and sources are stored with every AI output, so nothing is written without a trace.",
  },
  {
    title: "Least-privilege roles",
    description: "Seven per-project roles, so field staff, compliance officers, M&E and approvers each see and change only what their job needs.",
  },
];

const TRIALS_ENABLED = process.env.NEXT_PUBLIC_TRIALS_ENABLED === "1";

const PLANS = [
  {
    code: "STARTER",
    name: "Starter",
    monthly: "$0",
    annual: "$0",
    tagline: "For small organizations managing their first funded programme.",
    cta: { label: "Start free", href: "/signup" },
    highlight: false,
    features: [
      "1 active project + unlimited archived",
      "1 seat + 2 read-only viewers",
      "1 GB managed storage",
      "5 successful AI report drafts / month",
      "Evidence vault, provenance & audit trail",
      "Community support",
    ],
  },
  {
    code: "TEAM",
    name: "Team",
    monthly: "$79",
    annual: "$790",
    tagline: "For growing teams reporting across several grants or projects.",
    cta: { label: "Continue", href: "/signup?plan=team" },
    highlight: true,
    features: [
      "5 active projects + unlimited archived",
      "5 full seats + unlimited viewers",
      "25 GB managed storage",
      "20 successful AI report drafts / month",
      "AI donor-template extraction",
      "AI credit top-ups (+50 for $79)",
      TRIALS_ENABLED ? "14-day free trial" : "",
      "Email support",
      "NGO price: $59.25/mo (verified 25% welcome discount, first year)",
    ].filter(Boolean),
  },
  {
    code: "GROWTH",
    name: "Growth",
    monthly: "$149",
    annual: "$1,490",
    tagline: "For organizations with multiple funders and substantial reporting volume.",
    cta: { label: "Continue", href: "/signup?plan=growth" },
    highlight: false,
    features: [
      "20 active projects",
      "15 full seats + unlimited viewers",
      "100 GB managed storage",
      "100 successful AI report drafts / month",
      "Bring your own AI provider",
      "AI credit top-ups (+100 for $149)",
      TRIALS_ENABLED ? "14-day free trial" : "",
      "Soft overage instead of a hard stop",
      "Priority email support + onboarding call",
      "NGO price: $111.75/mo (verified 25% welcome discount, first year)",
    ].filter(Boolean),
  },
  {
    code: "ENTERPRISE",
    name: "Enterprise",
    monthly: "Custom",
    annual: "From $12k / year",
    tagline: "For INGOs, research institutions, public bodies, and multi-country programmes.",
    cta: { label: "Contact us", href: "/contact-sales" },
    highlight: false,
    features: [
      "Unlimited projects & seats",
      "Contractual storage & AI credits",
      "SSO / SCIM",
      "Custom data residency",
      "SLA & dedicated support",
      "Procurement & security review support",
    ],
  },
];

function ModuleGrid({ modules }: { modules: ModuleCard[] }) {
  return (
    <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {modules.map((m) => (
        <Link
          key={m.title}
          href={m.href}
          className="glass tech-card group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition duration-300 hover:-translate-y-1 hover:border-brand-400/40 hover:bg-white/[0.05]"
        >
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-brand-500/30 to-brand-700/20 text-2xl">
            {m.icon}
          </span>
          <span className="mt-5 inline-block rounded-full bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-300">
            {m.tag}
          </span>
          <h3 className="mt-3 text-xl font-bold text-white">{m.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">{m.description}</p>
          <span className="mt-4 inline-block text-sm font-semibold text-brand-300 transition group-hover:text-brand-200">
            What it does <span aria-hidden>→</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="landing-tech min-h-screen overflow-x-hidden bg-slate-950 text-slate-100">
      <MarketingNav />

      {/* Hero */}
      <section className="relative isolate px-6 pb-24 pt-20 sm:pt-28">
        <div aria-hidden className="tech-orb tech-orb-left" />
        <div aria-hidden className="tech-orb tech-orb-right" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_-10%,rgba(12,141,230,0.35),transparent)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]"
        />
        <div className="mx-auto max-w-5xl text-center">
          <div className="mx-auto mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-200 shadow-lg shadow-cyan-500/5 backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
            </span>
            Programme management for grant-funded work
          </div>
          <Image
            src="/brand/donordesk-logo.png"
            alt="DonorDesk"
            width={552}
            height={600}
            className="mx-auto h-40 w-auto object-contain sm:h-48 md:h-56"
            sizes="(min-width: 768px) 630px, (min-width: 640px) 540px, 450px"
            priority
          />
          <h1 className="mt-8 text-5xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl md:text-7xl">
            Run your programme.{" "}
            <span className="bg-gradient-to-r from-brand-300 via-brand-400 to-cyan-300 bg-clip-text text-transparent">
              Report from the record.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-300 sm:text-xl">
            DonorDesk holds your logframe, indicators, activities, evidence and
            compliance in one place. Donor reports come out of the work you
            already recorded, with every number traced and every report
            approved by a person.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-7 py-3.5 text-base font-semibold text-white shadow-xl shadow-brand-500/40 transition hover:from-brand-400 hover:to-brand-500 sm:w-auto"
            >
              Create a free workspace
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
            <Link
              href="/tour"
              className="inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-white/5 px-7 py-3.5 text-base font-semibold text-white backdrop-blur transition hover:bg-white/10 sm:w-auto"
            >
              Take the product tour
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-400">
            No credit card required · A demo project is included · A person approves every report
          </p>
        </div>

        {/* Sample project preview */}
        <div className="mx-auto mt-16 max-w-5xl">
          <div className="glass tech-dashboard relative overflow-hidden rounded-2xl border border-white/10 p-2 shadow-2xl shadow-brand-500/10">
            <div aria-hidden className="tech-scan-line" />
            <div className="rounded-xl bg-slate-900/80 p-5">
              <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex gap-1.5" aria-hidden>
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/70" />
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300/70">Sample project</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <p className="text-sm font-semibold text-white">Emergency Response — Health Programme</p>
                  <p className="text-xs text-slate-400">Semi-annual report · Q3 2026</p>
                </div>
                <span className="rounded-full bg-green-500/15 px-3 py-1 text-xs font-bold text-green-400">
                  ● 92% ready
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Activities accepted", value: "61 / 64", bar: "w-[95%]", color: "bg-green-400" },
                  { label: "Indicators reported", value: "24 / 25", bar: "w-[96%]", color: "bg-cyan-400" },
                  { label: "Evidence verified", value: "128 / 132", bar: "w-[97%]", color: "bg-brand-500" },
                ].map((m) => (
                  <div key={m.label} className="rounded-xl bg-white/5 p-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">{m.label}</span>
                      <span className="font-bold text-white">{m.value}</span>
                    </div>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div className={`h-full rounded-full ${m.bar} ${m.color}`} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-white/5 p-4">
                  <p className="text-xs font-semibold text-white">Draft section, with its source</p>
                  <p className="mt-2 text-sm text-slate-300">
                    “Community health workers delivered 1,240 consultations in Q3 (activity record 2041),
                    {" "}
                    <span className="text-brand-300 underline decoration-brand-400/50">[source: evidence 2041]</span>.”
                  </p>
                </div>
                <div className="flex flex-col justify-center gap-2 rounded-xl bg-white/5 p-4">
                  {[
                    { text: "✓ Donor template structure approved", done: true },
                    { text: "✓ Required evidence attached", done: true },
                    { text: "⚠ 2 indicators awaiting verification", done: false },
                  ].map((c) => (
                    <p key={c.text} className={`text-sm ${c.done ? "text-slate-300" : "text-amber-300"}`}>{c.text}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Programmes DonorDesk supports" className="border-y border-white/10 bg-white/[0.025] px-6 py-10">
        <div className="mx-auto max-w-7xl">
          <p className="text-center text-sm font-semibold text-slate-300">
            Built for humanitarian and development programmes, and for any grant-funded work that must show results.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {SECTORS.map((sector) => (
              <span key={sector} className="rounded-full border border-brand-400/20 bg-brand-400/[0.07] px-4 py-2 text-xs font-semibold text-brand-200">{sector}</span>
            ))}
          </div>
        </div>
      </section>

      {/* The record, plan to report */}
      <section id="system" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-brand-300">One record</p>
            <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              From the work you do to the report you owe
            </h2>
            <p className="mt-4 text-lg text-slate-300">
              The programme record is the working system. The donor report is what it produces, so the numbers,
              the evidence and the narrative are never rebuilt by hand.
            </p>
          </div>
          <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {RECORD_STAGES.map((s) => (
              <div key={s.step} className="relative rounded-2xl border border-white/10 bg-slate-900/70 p-6">
                <span className="absolute right-4 top-4 text-xs font-black tracking-widest text-brand-300/60">{s.step}</span>
                <div className="grid h-14 w-14 place-items-center rounded-2xl border border-brand-300/30 bg-gradient-to-br from-brand-500/30 via-cyan-400/10 to-slate-900 text-2xl font-black text-cyan-200 shadow-lg shadow-brand-500/20">
                  <span aria-hidden>{s.icon}</span>
                </div>
                <h3 className="mt-5 text-lg font-bold text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Run the programme */}
      <section id="run" className="border-y border-white/10 bg-white/[0.02] px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-brand-300">Run the programme</p>
            <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              The working system your team runs every day
            </h2>
            <p className="mt-4 text-lg text-slate-300">
              Logframe, activities, data, evidence and people. Each is useful on its own, long before a donor asks for a report.
            </p>
          </div>
          <ModuleGrid modules={RUN_MODULES} />
        </div>
      </section>

      {/* Report from the record */}
      <section id="reporting" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-brand-300">Report from the record</p>
            <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              Donor reports you can check, and approve with confidence
            </h2>
            <p className="mt-4 text-lg text-slate-300">
              Each section is drafted from the record, checked against it, and approved by a person before anything is released.
            </p>
          </div>
          <ModuleGrid modules={REPORT_MODULES} />
          <div className="mt-10 text-center">
            <Link href="/features" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-300 transition hover:text-brand-200">
              See every feature, with its limits
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>

      <ProductProofStrip />

      {/* How it works */}
      <section id="how-it-works" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-brand-300">How it works</p>
            <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              Start with the programme, finish with the report
            </h2>
            <p className="mt-4 text-lg text-slate-300">
              Set the programme up once. Keep the record current as the work happens. The report at each deadline is then a review, not a rebuild.
            </p>
          </div>
          <ol className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {HOW_STEPS.map((s) => (
              <li key={s.step} className="flex gap-4 rounded-2xl border border-white/10 bg-slate-900/70 p-6">
                <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-brand-500/20 font-bold text-cyan-200">{s.step}</span>
                <div>
                  <h3 className="font-bold text-white">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-300">{s.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="who-its-for" className="border-y border-white/10 bg-white/[0.02] px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-brand-300">Who it&apos;s for</p>
            <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">Built for evidence-heavy, grant-funded work</h2>
            <p className="mt-4 text-lg text-slate-300">
              Seven roles, so the people who run the programme, record it, check it and approve the report each see what they need.
            </p>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-5">
            {AUDIENCES.map((audience) => (
              <article key={audience.title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 transition hover:border-brand-400/40 hover:bg-white/[0.055]">
                <span aria-hidden className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500/15 text-xl text-cyan-200">{audience.icon}</span>
                <h3 className="mt-5 font-bold text-white">{audience.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{audience.description}</p>
              </article>
            ))}
          </div>
          <p className="mt-10 text-center text-sm text-slate-400">
            Roles: Admin · Project Manager · M&amp;E Officer · Grants Officer · Field Officer · Compliance Officer · Viewer
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-brand-300">Pricing</p>
            <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              Start free. Upgrade when the programme grows.
            </h2>
            <p className="mt-4 text-lg text-slate-300">
              Every plan includes the programme record, the evidence library with Google Drive link-first storage, exports
              and the audit log. Start on the free Starter plan and upgrade any time. Payment is handled securely at checkout.
            </p>
          </div>
          <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((plan) => (
              <div
                key={plan.code}
                className={`glass relative flex flex-col rounded-2xl border p-7 transition duration-300 ${
                  plan.highlight
                    ? "border-brand-400/50 bg-gradient-to-b from-brand-500/10 to-transparent shadow-xl shadow-brand-500/10"
                    : "border-white/10 bg-white/[0.03] hover:border-brand-400/30"
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-brand-500 to-brand-600 px-3 py-1 text-xs font-bold text-white shadow-lg">
                    Most popular
                  </span>
                )}
                <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                <p className="mt-1 text-sm text-slate-400">{plan.tagline}</p>
                <div className="mt-5 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-white">{plan.monthly}</span>
                  {plan.code !== "ENTERPRISE" && <span className="text-sm text-slate-400">/ month</span>}
                </div>
                {plan.code !== "ENTERPRISE" && (
                  <p className="mt-1 text-xs text-slate-400">or {plan.annual} / year (2 months free)</p>
                )}
                <ul className="mt-6 flex-1 space-y-2.5 text-sm text-slate-300">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span className="mt-0.5 text-brand-400">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.cta.href}
                  className={`mt-7 inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition ${
                    plan.highlight
                      ? "bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-500/30 hover:from-brand-400 hover:to-brand-500"
                      : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  {plan.cta.label}
                </Link>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/pricing" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-300 transition hover:text-brand-200">
              See the full plan comparison
              <span aria-hidden>→</span>
            </Link>
          </div>
          <p className="mt-6 text-center text-sm text-slate-400">
            Verified nonprofits get 25% off Team and Growth for their first year; nonprofit pricing for Enterprise is
            built into the contract. Tax is calculated at checkout where applicable. Annual billing gives two months free.
            Regional pricing for eligible organizations in lower-income countries is available on request. Contact sales.
          </p>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-brand-300">Trust &amp; security</p>
              <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                Built for sensitive programme and beneficiary data
              </h2>
              <p className="mt-4 text-lg text-slate-300">
                Tenant isolation, role-based access, traceable AI outputs and a hash-chained audit log. Our data processing
                agreement and subprocessor list are published. We do not hold external certifications, and we do not claim any.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-6 py-3 font-semibold text-white shadow-lg shadow-brand-500/30 transition hover:from-brand-400 hover:to-brand-500"
                >
                  Start your free workspace
                </Link>
                <Link
                  href="/security"
                  className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
                >
                  Read the security page
                </Link>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {SECURITY.map((s) => (
                <div key={s.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                  <span className="text-brand-300">◆</span>
                  <h3 className="mt-3 font-bold text-white">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-300">{s.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <HomeFaq />

      {/* Final CTA */}
      <section className="px-6 pb-24">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-brand-400/30 bg-gradient-to-br from-brand-600 via-brand-700 to-slate-900 px-6 py-16 text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_-20%,rgba(34,211,238,0.4),transparent)]"
          />
          <h2 className="relative text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Make the programme and the report one piece of work
          </h2>
          <p className="relative mx-auto mt-4 max-w-2xl text-lg text-brand-100">
            Keep the logframe, activities, evidence and compliance in one record, and produce each donor report from it.
          </p>
          <div className="relative mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex w-full items-center justify-center rounded-xl bg-white px-7 py-3.5 font-bold text-brand-700 shadow-xl transition hover:bg-brand-50 sm:w-auto"
            >
              Get started free
            </Link>
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-xl border border-white/30 px-7 py-3.5 font-semibold text-white transition hover:bg-white/10 sm:w-auto"
            >
              Log in
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
      <CookieConsentBanner />
      <Script id="voxeleon-chat" strategy="afterInteractive">{`
        window.voxeleonSettings = {"position":"right","type":"standard","launcherTitle":""};
        (function(d,t){
          var BASE_URL="https://app.voxeleon.com";
          var g=d.createElement(t),s=d.getElementsByTagName(t)[0];
          g.src=BASE_URL+"/packs/js/voxeleon-sdk.js";
          g.async=true;
          s.parentNode.insertBefore(g,s);
          g.onload=function(){
            window.voxeleonSDK.run({websiteToken:'PiC3TqgB2V3xSYpE7M6Asz7G',baseUrl:BASE_URL});
          };
        })(document,"script");
      `}</Script>
    </main>
  );
}
