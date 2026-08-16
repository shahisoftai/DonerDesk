import Link from "next/link";
import Image from "next/image";

const FEATURES = [
  {
    icon: "🧩",
    title: "Donor template extraction",
    description:
      "Drop in any donor template and DonorDesk structures it into editable sections, with the exact evidence each asks for mapped to your programme.",
    tag: "Save weeks of formatting",
  },
  {
    icon: "✨",
    title: "Source-linked AI drafting",
    description:
      "Every AI-generated paragraph is cited back to verified evidence and indicator data. Nothing is black-box — every line is reviewable and human-approved.",
    tag: "AI as assistant, not author",
  },
  {
    icon: "✅",
    title: "Live compliance checklist",
    description:
      "A real-time readiness score surfaces missing evidence, unverified indicators, and late activity updates long before the submission deadline.",
    tag: "Never miss a requirement",
  },
  {
    icon: "🧾",
    title: "Evidence that holds up to audit",
    description:
      "Upload PDF, DOCX, XLSX, TXT and ZIP evidence with checksums and an immutable audit chain. Export the exact originals, byte for byte.",
    tag: "Audit-ready by default",
  },
  {
    icon: "📊",
    title: "Logframes & indicators",
    description:
      "Model objectives, outcomes, outputs, and indicators with baselines and targets — then drive narrative reporting straight from your numbers.",
    tag: "Outcome-oriented reporting",
  },
  {
    icon: "📦",
    title: "Donor-ready exports",
    description:
      "Generate polished PDF, DOCX, XLSX, and ZIP deliverables for each donor. Every report is editable, reviewed, and approved before you send it.",
    tag: "One-click deliverable packs",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Set up your workspace",
    description:
      "Create your organization, invite your team, and import your donor templates and logframe. DonorDesk fits the way your programme already works.",
  },
  {
    step: "02",
    title: "Capture evidence as it happens",
    description:
      "Field staff log activity updates, upload photos and documents, and update indicators from anywhere — with every item tied to your project.",
  },
  {
    step: "03",
    title: "Draft, review, and deliver",
    description:
      "AI drafts source-linked narrative from your evidence. Your team reviews, the compliance checklist clears, and you export donor-ready reports.",
  },
];

const SECURITY = [
  {
    title: "Multi-tenant by design",
    description:
      "Every aggregate carries a tenant ID, enforced with row-level security so no organization can ever see another's data.",
  },
  {
    title: "Immutable audit log",
    description:
      "Every mutation is recorded with a chained, verifiable audit trail — ready for internal compliance and external donor review.",
  },
  {
    title: "Reviewable AI",
    description:
      "Model, prompt version, and source references are stored with every AI output so nothing is written without a trace.",
  },
  {
    title: "Least-privilege roles",
    description:
      "Project-level assignments and role-based authorization keep access tight, from field staff to approvers and admins.",
  },
];

const PLANS = [
  {
    code: "STARTER",
    name: "Starter",
    monthly: "$0",
    annual: "$0",
    tagline: "For small teams getting started with donor reporting.",
    cta: { label: "Start free", href: "/signup" },
    highlight: false,
    features: [
      "1 active project",
      "1 seat (owner)",
      "1 GB managed storage",
      "5 successful AI report drafts / month",
      "Core reporting, logframe & exports",
      "Community support",
    ],
  },
  {
    code: "TEAM",
    name: "Team",
    monthly: "$59",
    annual: "$590",
    tagline: "For growing programmes with multiple projects.",
    cta: { label: "Start 14-day trial", href: "/signup?plan=team" },
    highlight: true,
    features: [
      "5 active projects",
      "5 seats",
      "25 GB managed storage",
      "100 successful AI report drafts / month",
      "Google Drive link-first storage",
      "Email support",
    ],
  },
  {
    code: "GROWTH",
    name: "Growth",
    monthly: "$149",
    annual: "$1,490",
    tagline: "For larger teams with heavy reporting volume.",
    cta: { label: "Start 14-day trial", href: "/signup?plan=growth" },
    highlight: false,
    features: [
      "20 active projects",
      "15 seats",
      "100 GB managed storage",
      "500 successful AI report drafts / month",
      "R2-managed uploads within quota",
      "Priority email support",
    ],
  },
  {
    code: "ENTERPRISE",
    name: "Enterprise",
    monthly: "Custom",
    annual: "Annual contract",
    tagline: "For federations, INGOs and multi-country programmes.",
    cta: { label: "Contact us", href: "mailto:sales@donordesk.online" },
    highlight: false,
    features: [
      "Unlimited projects & seats",
      "Contractual storage",
      "SSO / SCIM",
      "Custom data residency",
      "SLA & dedicated support",
      "Nonprofit discounts available",
    ],
  },
];

const STATS = [
  { value: "7+", label: "Programme modules" },
  { value: "4", label: "Export formats" },
  { value: "100%", label: "Source-linked AI output" },
  { value: "0", label: "Black-box decisions" },
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-950 text-slate-100">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <a href="/" className="flex items-center">
            <Image
              src="/brand/donordesk-logo.png"
              alt="DonorDesk"
              width={1653}
              height={589}
              className="h-9 w-auto object-contain"
            />
          </a>
          <div className="hidden items-center gap-8 text-sm font-medium text-slate-300 md:flex">
            <a href="#features" className="transition hover:text-white">Features</a>
            <a href="#how-it-works" className="transition hover:text-white">How it works</a>
            <a href="#pricing" className="transition hover:text-white">Pricing</a>
            <a href="#security" className="transition hover:text-white">Security</a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-200 transition hover:text-white"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-500/30 transition hover:from-brand-400 hover:to-brand-500"
            >
              Get started
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative isolate px-6 pb-24 pt-20 sm:pt-28">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_-10%,rgba(12,141,230,0.35),transparent)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]"
        />
        <div className="mx-auto max-w-5xl text-center">
          <Image
            src="/brand/donordesk-logo.png"
            alt="DonorDesk"
            width={1653}
            height={589}
            className="mx-auto h-40 w-auto object-contain sm:h-48 md:h-56"
            priority
          />
          <h1 className="mt-8 text-5xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl md:text-7xl">
            DonorDesk — from scattered field evidence to{" "}
            <span className="bg-gradient-to-r from-brand-300 via-brand-400 to-cyan-300 bg-clip-text text-transparent">
              donor-ready reports
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-300 sm:text-xl">
            DonorDesk is the AI-assisted donor reporting platform for NGOs. It
            turns messy field evidence, activity notes, and logframe data into
            audit-ready donor reports — with source-linked AI drafting, a live
            compliance checklist, and exports that stand up to any review.
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
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-white/5 px-7 py-3.5 text-base font-semibold text-white backdrop-blur transition hover:bg-white/10 sm:w-auto"
            >
              Log in to your workspace
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-400">
            No credit card required · Set up in minutes · Demo credentials ready
          </p>
        </div>

        {/* Mock dashboard preview */}
        <div className="mx-auto mt-16 max-w-5xl">
          <div className="glass relative overflow-hidden rounded-2xl border border-white/10 p-2 shadow-2xl shadow-brand-500/10">
            <div className="rounded-xl bg-slate-900/80 p-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="text-sm font-semibold text-white">Emergency Response — Health Programme</p>
                  <p className="text-xs text-slate-400">Report readiness · Q3 2026</p>
                </div>
                <span className="rounded-full bg-green-500/15 px-3 py-1 text-xs font-bold text-green-400">
                  ● 92% ready
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Evidence verified", value: "128 / 132", bar: "w-[97%]", color: "bg-brand-500" },
                  { label: "Indicators on track", value: "24 / 25", bar: "w-[96%]", color: "bg-cyan-400" },
                  { label: "Activities logged", value: "61 / 64", bar: "w-[95%]", color: "bg-green-400" },
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
                  <p className="text-xs font-semibold text-white">Source-linked AI draft</p>
                  <p className="mt-2 text-sm text-slate-300">
                    “Community health workers delivered 1,240 consultations in Q3 (Indic 4.1, {""}
                    <span className="text-brand-300 underline decoration-brand-400/50">[evidence-2041]</span>), an
                    increase of 18% over target.”
                  </p>
                </div>
                <div className="flex flex-col justify-center gap-2 rounded-xl bg-white/5 p-4">
                  {[
                    { text: "✓ Template sections mapped", done: true },
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

      {/* Stats band */}
      <section className="border-y border-white/10 bg-white/[0.02] py-14">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-6 text-center md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label}>
              <p className="text-4xl font-extrabold text-transparent [background:linear-gradient(to_right,#36a8f6,#22d3ee)] bg-clip-text">
                {s.value}
              </p>
              <p className="mt-1 text-sm text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-brand-300">Features</p>
            <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              Everything you need to report with confidence
            </h2>
            <p className="mt-4 text-lg text-slate-300">
              Built for humanitarian programmes that answer to multiple donors with
              rigorous compliance requirements.
            </p>
          </div>
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="glass group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition duration-300 hover:-translate-y-1 hover:border-brand-400/40 hover:bg-white/[0.05]"
              >
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-brand-500/30 to-brand-700/20 text-2xl">
                  {f.icon}
                </span>
                <span className="mt-5 inline-block rounded-full bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-300">
                  {f.tag}
                </span>
                <h3 className="mt-3 text-xl font-bold text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-brand-300">How it works</p>
            <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              From field notes to final report in three moves
            </h2>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.step} className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-8">
                <span className="bg-gradient-to-br from-brand-400 to-cyan-300 bg-clip-text text-5xl font-black text-transparent">
                  {s.step}
                </span>
                <h3 className="mt-4 text-xl font-bold text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-brand-300">Pricing</p>
            <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              Start free. Upgrade when you grow.
            </h2>
            <p className="mt-4 text-lg text-slate-300">
              Every plan includes core donor reporting. Tax is calculated at
              checkout where applicable. Annual billing gives two months free.
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
          <p className="mt-8 text-center text-sm text-slate-400">
            Team and Growth plans include a 14-day trial with Growth entitlements — no card required. Qualified
            small NGOs can apply for a 40% nonprofit discount.
          </p>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-brand-300">Trust & security</p>
              <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                Built for the most sensitive donor data
              </h2>
              <p className="mt-4 text-lg text-slate-300">
                DonorDesk treats beneficiary data and compliance as first-class concerns —
                not an afterthought. Your evidence, audit trails, and AI outputs are
                governed and verifiable end to end.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-6 py-3 font-semibold text-white shadow-lg shadow-brand-500/30 transition hover:from-brand-400 hover:to-brand-500"
                >
                  Start your free workspace
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
                >
                  Log in
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

      {/* Testimonial */}
      <section className="px-6 py-24">
        <figure className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-gradient-to-br from-brand-500/10 to-cyan-400/10 p-10 text-center">
          <blockquote className="text-xl font-medium leading-relaxed text-slate-100 sm:text-2xl">
            “DonorDesk cut our reporting cycle from six weeks to under a week. The
            compliance checklist alone saved us from two missed deliverables last
            quarter.”
          </blockquote>
          <figcaption className="mt-6">
            <p className="font-bold text-white">M&E Lead, international NGO</p>
            <p className="text-sm text-slate-400">Reporting for 12 donors across 3 countries</p>
          </figcaption>
        </figure>
      </section>

      {/* Final CTA */}
      <section className="px-6 pb-24">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-brand-400/30 bg-gradient-to-br from-brand-600 via-brand-700 to-slate-900 px-6 py-16 text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_-20%,rgba(34,211,238,0.4),transparent)]"
          />
          <h2 className="relative text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Your next donor report, ready in hours
          </h2>
          <p className="relative mx-auto mt-4 max-w-2xl text-lg text-brand-100">
            Stop assembling spreadsheets and emails. Let DonorDesk gather the evidence,
            draft the narrative, and keep you audit-ready — all in one place.
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

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center">
            <Image
              src="/brand/donordesk-logo.png"
              alt="DonorDesk"
              width={1653}
              height={589}
              className="h-10 w-auto object-contain"
            />
          </div>
          <p className="text-sm text-slate-400">
            © {new Date().getFullYear()} DonorDesk. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-slate-400">
            <Link href="/login" className="transition hover:text-white">Log in</Link>
            <Link href="/signup" className="transition hover:text-white">Get started</Link>
            <Link href="/privacy" className="transition hover:text-white">Privacy</Link>
            <Link href="/terms" className="transition hover:text-white">Terms</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
