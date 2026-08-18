import Link from "next/link";
import Image from "next/image";

const CATEGORIES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    title: "Getting Started",
    description: "Onboarding, account setup, and dashboard tour.",
    href: "/support/getting-started",
    color: "from-brand-500/25 to-cyan-500/15",
    borderColor: "hover:border-brand-400/50",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
    title: "How-To Guides",
    description: "Step-by-step tutorials for every DonorDesk feature.",
    href: "/support/how-to",
    color: "from-cyan-500/25 to-blue-500/15",
    borderColor: "hover:border-cyan-400/50",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    title: "Donor Reporting Skills",
    description: "Report writing guides, donor requirements, and templates.",
    href: "/support/report-writing-skills",
    color: "from-amber-500/25 to-orange-500/15",
    borderColor: "hover:border-amber-400/50",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
      </svg>
    ),
    title: "Troubleshooting",
    description: "Fix login, payment, and data issues fast.",
    href: "/support/troubleshooting",
    color: "from-rose-500/25 to-pink-500/15",
    borderColor: "hover:border-rose-400/50",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.165-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: "Advanced Features",
    description: "API, webhooks, automation, and integrations.",
    href: "/support/advanced-features",
    color: "from-violet-500/25 to-purple-500/15",
    borderColor: "hover:border-violet-400/50",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    ),
    title: "Account & Billing",
    description: "Plans, invoices, payment methods, and cancellations.",
    href: "/support/account-billing",
    color: "from-emerald-500/25 to-teal-500/15",
    borderColor: "hover:border-emerald-400/50",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
      </svg>
    ),
    title: "Security & Privacy",
    description: "Data protection, GDPR compliance, and best practices.",
    href: "/support/security-privacy",
    color: "from-amber-500/25 to-orange-500/15",
    borderColor: "hover:border-amber-400/50",
  },
];

const POPULAR_GUIDES = [
  { title: "How to set up a new organisation", href: "/support/how-to/how-to-set-up-new-organisation", category: "How-To" },
  { title: "Understanding donor reporting requirements", href: "/support/reference-donor-reporting-guidelines", category: "Reference" },
  { title: "Troubleshooting login issues", href: "/support/troubleshooting-login-issues", category: "Troubleshooting" },
  { title: "How to export donor data", href: "/support/how-to/how-to-export-donor-data", category: "How-To" },
  { title: "Setting up payment integrations", href: "/support/how-to/how-to-set-up-payment-integrations", category: "How-To" },
  { title: "Advanced features: using the API", href: "/support/advanced-features/advanced-features-using-the-api", category: "Advanced" },
];

const RECENT_GUIDES = [
  { title: "Donor Reporting Guidelines Index", href: "/support/reference-donor-reporting-guidelines", category: "New" },
  { title: "How to use the activity feed", href: "/support/how-to/how-to-use-the-activity-feed", category: "How-To" },
  { title: "Troubleshooting failed payments", href: "/support/troubleshooting-payment-issues", category: "Troubleshooting" },
  { title: "Security best practices", href: "/support/security-best-practices", category: "Security" },
  { title: "Report Writing Fundamentals", href: "/support/report-writing-skills/fundamentals", category: "Report Writing" },
  { title: "How to manage billing and subscription", href: "/support/how-to/how-to-manage-billing-subscription", category: "How-To" },
];

const DONOR_NAMES = [
  "DG ECHO", "UNHCR", "USAID", "Global Fund", "GCF", "FCDO", "Norad", "Sida", "Danida",
];

const REPORT_SKILL_SUBCATS = [
  {
    label: "Foundation",
    items: ["Report Writing Fundamentals", "Indicators & Evidence", "Writing Clearly for Donors"],
    href: "/support/report-writing-skills/report-writing-fundamentals",
    accent: "bg-amber-500/15 border-amber-400/30",
  },
  {
    label: "Donor-Specific",
    items: [
      "Humanitarian & UN Reporting",
      "Bilateral Government Donors",
      "EU Development Grants",
      "Global Health & Education Funds",
      "Climate & Environmental Funds",
    ],
    href: "/support/report-writing-skills/unhcr-reporting",
    accent: "bg-orange-500/15 border-orange-400/30",
  },
  {
    label: "Tools & Templates",
    items: [
      "Pre-Report Checklist",
      "Donor Requirements Comparison",
      "Evidence Inventory Template",
      "Report Writing Glossary",
    ],
    href: "/support/report-writing-skills/pre-report-checklist",
    accent: "bg-yellow-500/15 border-yellow-400/30",
  },
];

export default function SupportPage() {
  return (
    <div className="landing-tech min-h-screen overflow-x-hidden bg-slate-950 text-slate-100">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/85 shadow-[0_10px_40px_rgba(2,6,23,0.35)] backdrop-blur-2xl supports-[backdrop-filter]:bg-slate-950/70">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center">
            <Image
              src="/brand/donordesk-logo.png"
              alt="DonorDesk"
              width={1653}
              height={589}
              className="h-9 w-auto object-contain"
            />
            <span className="ml-3 text-sm font-medium text-slate-400">Support Center</span>
          </Link>
          <div className="hidden items-center gap-7 text-sm font-medium text-slate-300 lg:flex">
            <Link href="/" className="transition hover:text-white">Home</Link>
            <Link href="/pricing" className="transition hover:text-white">Pricing</Link>
            <Link href="/support" className="transition hover:text-white text-brand-300">Support</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-200 transition hover:text-white"
            >
              Log in
            </Link>
            <Link
              href="/support/contact"
              className="rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-500/30 transition hover:from-brand-400 hover:to-brand-500"
            >
              Submit a ticket
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative isolate px-6 pb-20 pt-16 sm:pt-24">
        <div aria-hidden className="tech-orb tech-orb-left" />
        <div aria-hidden className="tech-orb tech-orb-right" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_-10%,rgba(12,141,230,0.25),transparent)]"
        />
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            How can we help you?
          </h1>
          <p className="mt-4 text-lg text-slate-300">
            Find guides, donor reporting references, tutorials, and troubleshooting for DonorDesk.
          </p>
          {/* Search */}
          <div className="relative mx-auto mt-8 max-w-xl">
            <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
              <svg className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              type="search"
              placeholder="Search guides, how-tos, donor requirements..."
              className="w-full rounded-xl border border-white/15 bg-white/5 py-3.5 pl-11 pr-4 text-sm text-white placeholder-slate-400 backdrop-blur focus:border-brand-400/60 focus:outline-none focus:ring-1 focus:ring-brand-400/40"
            />
          </div>
          {/* Quick links */}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {["Getting Started", "Donor Reporting", "Billing", "API", "Troubleshooting"].map((q) => (
              <a
                key={q}
                href={`#${q.toLowerCase().replace(/\s+/g, "-")}`}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-slate-300 transition hover:border-brand-400/40 hover:text-brand-300"
              >
                {q}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Browse by Category */}
      <section id="browse" className="px-6 pb-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.title}
                href={cat.href}
                className={`glass tech-card group relative flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition duration-300 hover:-translate-y-1 hover:border-brand-400/40 hover:bg-white/[0.05] ${cat.borderColor}`}
              >
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${cat.color}`}>
                  <span className="text-brand-300">{cat.icon}</span>
                </div>
                <h3 className="mt-5 text-lg font-bold text-white">{cat.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-300">{cat.description}</p>
                <span className="mt-4 text-xs font-semibold text-brand-400 opacity-0 transition group-hover:opacity-100">
                  Browse →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Report Writing Skills — Featured Section */}
      <section className="border-y border-white/10 bg-white/[0.02] px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/25 to-orange-500/15">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5 text-amber-300">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-400">Featured</p>
              <h2 className="text-2xl font-extrabold text-white">Report Writing Skills</h2>
            </div>
          </div>
          <p className="max-w-2xl text-slate-300">
            Master donor reporting — from understanding requirements and writing clear narratives to navigating compliance checklists and submitting on time.
          </p>

          {/* Three sub-category cards */}
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {REPORT_SKILL_SUBCATS.map((sub) => (
              <Link
                key={sub.label}
                href={sub.href}
                className={`tech-card group relative rounded-2xl border p-6 transition duration-300 hover:-translate-y-1 hover:bg-white/[0.04] ${sub.accent}`}
              >
                <h3 className="font-bold text-white">{sub.label}</h3>
                <ul className="mt-3 space-y-2">
                  {sub.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="mt-1 text-amber-400">›</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <span className="mt-5 inline-block text-xs font-semibold text-amber-400 opacity-0 transition group-hover:opacity-100">
                  Explore → 
                </span>
              </Link>
            ))}
          </div>

          {/* Donor badges */}
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-slate-400">Aligned with:</span>
            {DONOR_NAMES.map((name) => (
              <span
                key={name}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Popular & Recent Guides */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-2">
            {/* Popular */}
            <div>
              <h2 className="text-lg font-bold text-white">Popular guides</h2>
              <div className="mt-5 space-y-1">
                {POPULAR_GUIDES.map((g) => (
                  <Link
                    key={g.title}
                    href={g.href}
                    className="group flex items-center justify-between rounded-xl border border-transparent px-4 py-3 transition hover:border-white/10 hover:bg-white/[0.03]"
                  >
                    <div className="flex items-center gap-3">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 flex-shrink-0 text-slate-500 transition group-hover:text-brand-400">
                        <path fillRule="evenodd" d="M4.5 3A1.5 1.5 0 003 4.5v11A1.5 1.5 0 004.5 17h11a1.5 1.5 0 001.5-1.5v-11A1.5 1.5 0 0015.5 3h-11zM10 5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v3a.5.5 0 01-.5.5h-3a.5.5 0 01-.5-.5V5zM8 9.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v3a.5.5 0 01-.5.5h-3a.5.5 0 01-.5-.5v-3z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-slate-200 transition group-hover:text-white">{g.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{g.category}</span>
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-slate-600 transition group-hover:text-brand-400 group-hover:translate-x-0.5">
                        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Recent */}
            <div>
              <h2 className="text-lg font-bold text-white">Recently updated</h2>
              <div className="mt-5 space-y-1">
                {RECENT_GUIDES.map((g) => (
                  <Link
                    key={g.title}
                    href={g.href}
                    className="group flex items-center justify-between rounded-xl border border-transparent px-4 py-3 transition hover:border-white/10 hover:bg-white/[0.03]"
                  >
                    <div className="flex items-center gap-3">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 flex-shrink-0 text-slate-500 transition group-hover:text-brand-400">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-slate-200 transition group-hover:text-white">{g.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${g.category === "New" ? "bg-emerald-500/15 text-emerald-300" : "text-slate-500 bg-white/5"}`}>
                        {g.category}
                      </span>
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-slate-600 transition group-hover:text-brand-400 group-hover:translate-x-0.5">
                        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Support Options */}
      <section className="border-t border-white/10 px-6 py-16">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
                <path d="M3 4a2 2 0 00-2 2v1.16l5.313-2.458a2 2 0 011.789 1.106L3 8.18V6a2 2 0 00-2-2H1a2 2 0 00-2 2v10a2 2 0 002 2h2a2 2 0 002-2v-2.18l5.313 2.458a2 2 0 001.789-1.106L7 17.18V18a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2h-2a2 2 0 00-2 2v2.18l-5.313-2.458a2 2 0 00-1.789 1.106L5 15.82V18a2 2 0 002 2h2a2 2 0 002-2v-2.18l5.313 2.458a2 2 0 001.789-1.106L15 15.82V14a2 2 0 00-2-2H9.82l5.313-2.458a2 2 0 00-1.789-1.106L9.82 11H7.5a.5.5 0 01-.5-.5v-2a.5.5 0 01.5-.5H9l5.313-2.458a2 2 0 00-1.789-1.106L9.82 6H7.5a.5.5 0 01-.5-.5V3.5a.5.5 0 01.5-.5H9l5.313-2.458a2 2 0 00-1.789-1.106L9.82 1H7a2 2 0 00-2 2v2h2V3a2 2 0 012-2h2a2 2 0 012 2v1h2V3a2 2 0 012 2v1.18l-5.313 2.458a2 2 0 001.789 1.106L15.18 5H17a2 2 0 012 2v2h-2v2a2 2 0 01-2 2h-2a2 2 0 00-2 2v2h2a2 2 0 002 2h2v2a2 2 0 01-2 2h-2v2a2 2 0 01-2 2H9a2 2 0 01-2-2v-2H5a2 2 0 01-2-2v-2h2z" />
              </svg>
            </div>
            <h3 className="mt-4 font-bold text-white">Email Support</h3>
            <p className="mt-2 text-sm text-slate-400">support@donordesk.online</p>
            <p className="mt-1 text-xs text-slate-500">Response in 1–2 business days</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
                <path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.78 3.276a3.003 3.003 0 01-.53 1.277 5.01 5.01 0 01.22.773c.25.76.495 1.827.64 2.941H8.756c.146-1.114.39-2.18.64-2.941.07-.267.14-.517.22-.773.248-.545.497-1.044.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.146-1.114.39-2.18.64-2.941.07-.267.14-.517.22-.773.248-.545.497-1.044.737-1.182.233-.23.389-.262.465-.262.076 0 .232.032.465.262.238.234.497.623.737 1.182.389.907.673 2.142.78 3.276a3.003 3.003 0 01.53-1.277 5.01 5.01 0 01-.22-.773c-.25-.76-.495-1.827-.64-2.941h1.948c.146 1.114.39 2.18.64 2.941.07.267.14.517.22.773a5.01 5.01 0 01-.22.773 3.003 3.003 0 01-.53 1.277 5.01 5.01 0 01.22-.773c.25-.76.495-1.827.64-2.941zM14 10a2 2 0 11-4 0 2 2 0 014 0z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="mt-4 font-bold text-white">Documentation</h3>
            <p className="mt-2 text-sm text-slate-400">100+ guides across 8 categories</p>
            <p className="mt-1 text-xs text-slate-500">Searchable, always up to date</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="mt-4 font-bold text-white">Feature Requests</h3>
            <p className="mt-2 text-sm text-slate-400">Vote on features or suggest new ones</p>
            <p className="mt-1 text-xs text-slate-500">Via the in-app feedback form</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex flex-col items-center gap-3">
            <Link href="/" aria-label="DonorDesk home" className="flex items-center rounded-lg transition hover:opacity-85">
              <Image
                src="/brand/donordesk-logo.png"
                alt="DonorDesk"
                width={1653}
                height={589}
                className="h-[50px] w-auto object-contain"
              />
            </Link>
            <a
              href="https://www.linkedin.com/company/donordesk-online/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="DonorDesk on LinkedIn"
              className="flex items-center gap-2 text-slate-400 transition hover:text-white"
            >
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              <span className="text-sm">Follow us on LinkedIn</span>
            </a>
          </div>
          <p className="text-sm text-slate-400">
            © {new Date().getFullYear()} DonorDesk. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-slate-400">
            <Link href="/login" className="transition hover:text-white">Log in</Link>
            <Link href="/signup" className="transition hover:text-white">Get started</Link>
            <Link href="/privacy" className="transition hover:text-white">Privacy</Link>
            <Link href="/terms" className="transition hover:text-white">Terms</Link>
            <Link href="/support" className="transition hover:text-white text-brand-300">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
