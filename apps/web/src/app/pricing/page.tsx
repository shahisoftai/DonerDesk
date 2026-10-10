import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { CookieConsentBanner } from "@/components/legal/CookieConsentBanner";

export const metadata: Metadata = {
  alternates: { canonical: "/pricing" },
  title: "Plans & Pricing",
  description:
    "DonorDesk plans and pricing: start free, upgrade when you grow. AI-assisted donor reporting, evidence management, and compliance for NGOs.",
};

type Cell = string | { text: string; muted?: boolean };

const TRIALS_ENABLED = process.env.NEXT_PUBLIC_TRIALS_ENABLED === "1";

const PLANS = [
  {
    code: "STARTER",
    name: "Free",
    priceLine: "$0",
    annualLine: "forever",
    tagline: "Run your first funded programme properly.",
    cta: { label: "Start free", href: "/signup" },
    highlight: false,
    benefits: [
      "1 active project — finish a grant, keep the evidence, start the next one (archived projects never count)",
      "1 owner seat plus 2 read-only viewers — show donors, board members, or auditors the real product",
      "5 successful AI report drafts every month — enough to run your first funded programme",
      "Full evidence vault with Google Drive link-first storage and R2 uploads within quota",
      "Claim-level provenance: every number in a draft traces to a verified source",
      "Immutable audit trail and human-approved review workflow",
      "Core reporting, logframe & indicator tracking, DOCX/PDF exports",
      "Community support",
    ],
  },
  {
    code: "TEAM",
    name: "Team",
    priceLine: "$79",
    annualLine: TRIALS_ENABLED
      ? "$790 / year (2 months free) · 14-day free trial"
      : "$790 / year (2 months free)",
    tagline: "For growing teams reporting across several grants or projects.",
    cta: { label: TRIALS_ENABLED ? "Start 14-day trial" : "Choose Team", href: "/signup?plan=team" },
    highlight: true,
    benefits: [
      "Everything in Free, plus:",
      "$59.25/mo for verified nonprofits (25% welcome discount, first year)",
      "5 active projects with unlimited archived history",
      "5 full seats plus unlimited read-only viewers for field staff, partners, and auditors",
      "20 successful AI report drafts / month, topped up with +50 credit packs ($79) instead of a forced tier jump",
      "AI donor-template extraction: upload a donor's guidelines and get structured sections, mandatory questions, and evidence needs",
      "Full review & approval workflow with claim-level provenance for every number",
      "25 GB managed storage",
      "Email support · 25% nonprofit welcome discount (first year) for qualifying organizations",
    ],
  },
  {
    code: "GROWTH",
    name: "Growth",
    priceLine: "$149",
    annualLine: TRIALS_ENABLED
      ? "$1,490 / year (2 months free) · 14-day free trial"
      : "$1,490 / year (2 months free)",
    tagline: "For organizations with multiple funders and substantial reporting volume.",
    cta: { label: TRIALS_ENABLED ? "Start 14-day trial" : "Choose Growth", href: "/signup?plan=growth" },
    highlight: false,
    benefits: [
      "Everything in Team, plus:",
      "$111.75/mo for verified nonprofits (25% welcome discount, first year)",
      "20 active projects, 15 full seats, 100 GB managed storage",
      "100 successful AI report drafts / month with +100 credit packs ($149) and a prepaid standing balance — keep generating past the quota instead of stopping",
      "Bring your own AI provider: connect your own LLM keys and your drafts consume zero DonorDesk credits",
      "Table-of-contents-first template extraction with report-wide requirements and section hierarchy",
      "Priority email support and a 30-minute onboarding call",
      "25% nonprofit welcome discount (first year) for qualifying organizations",
    ],
  },
  {
    code: "ENTERPRISE",
    name: "Enterprise",
    priceLine: "Custom",
    annualLine: "Annual contract from $12,000 / year · guided pilot",
    tagline: "For INGOs, research institutions, public bodies, and multi-country programmes.",
    cta: { label: "Talk to us", href: "/contact-sales" },
    highlight: false,
    benefits: [
      "Unlimited or contracted projects, seats, storage, and a pooled AI credit allowance",
      "SSO / SCIM directory integration",
      "Custom data residency",
      "SLA with dedicated customer success management",
      "Assisted procurement: security questionnaires, vendor review, DPA, pilot design",
      "Nonprofit pricing built into the contract",
    ],
  },
];

const COMPARISON: { label: string; cells: [Cell, Cell, Cell, Cell] }[] = [
  { label: "Monthly price", cells: ["$0", "$79", "$149", "Custom"] },
  { label: "Annual price (2 months free)", cells: ["$0", "$790", "$1,490", "From $12,000/yr"] },
  { label: "NGO welcome price — 25% off, first year", cells: ["—", "$59.25/mo · $592.50/yr", "$111.75/mo · $1,117.50/yr", "Built into contract"] },
  { label: "Active projects", cells: ["1", "5", "20", "Unlimited / contracted"] },
  { label: "Archived projects", cells: ["Unlimited", "Unlimited", "Unlimited", "Unlimited"] },
  { label: "Full seats", cells: ["1 (owner)", "5", "15", "Unlimited / contracted"] },
  { label: "Read-only viewer seats", cells: ["2", "Unlimited", "Unlimited", "Unlimited"] },
  { label: "Managed storage", cells: ["1 GB", "25 GB", "100 GB", "Contracted"] },
  { label: "Successful AI report drafts / month", cells: ["5", "20", "100", "Contracted pool"] },
  { label: "AI credit top-up packs", cells: ["—", "+50 pack $79", "+100 pack $149 & prepaid standing balance", "Custom pool"] },
  { label: "Core reporting, logframe & indicators", cells: ["✓", "✓", "✓", "✓"] },
  { label: "Evidence vault + Google Drive link-first", cells: ["✓", "✓", "✓", "✓"] },
  { label: "R2-managed uploads", cells: ["Within quota", "Within quota", "Within quota", "Contracted"] },
  { label: "Claim-level provenance & source linking", cells: ["View", "Full", "Full", "Full"] },
  { label: "Review / approval workflow & versioning", cells: ["✓", "✓", "✓", "✓"] },
  { label: "Immutable audit trail", cells: ["✓", "✓", "✓", "✓"] },
  { label: "Donor template import & extraction", cells: ["Manual entry", "AI extraction", "TOC-first v2 + report-wide requirements", "+ custom onboarding"] },
  { label: "DOCX / PDF / donor-template exports", cells: ["✓", "✓", "✓", "✓"] },
  { label: "Bring your own AI provider (zero credits used)", cells: ["—", "—", "✓", "✓"] },
  { label: "Support", cells: ["Community", "Email", "Priority email + onboarding call", "SLA + dedicated CSM"] },
  { label: "SSO / SCIM", cells: ["—", "—", "—", "✓"] },
  { label: "Custom data residency", cells: ["—", "—", "—", "✓"] },
  { label: "Security review support", cells: ["—", "—", "Public trust page", "Assisted"] },
  { label: "Regional / PPP pricing", cells: ["—", "On request", "On request", "Built into contract"] },
  ...(TRIALS_ENABLED ? [{ label: "14-day free trial", cells: ["—", "✓", "✓", "Guided pilot"] as [Cell, Cell, Cell, Cell] }] : []),
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "What counts as an AI report draft?",
    a: "One successfully persisted full report draft consumes exactly one credit. Regenerating a report consumes another. Failed or timed-out generations are never billed, and manual report writing never consumes credits.",
  },
  ...(TRIALS_ENABLED
    ? [
        {
          q: "How does the 14-day free trial work?",
          a: "Start any paid plan with a full-feature 14-day trial — no credit card required. When the trial ends you keep your data and fall back to the free Starter allocation; nothing is deleted, exported, or locked away.",
        },
      ]
    : []),
  {
    q: "What are read-only viewers?",
    a: "Viewers can browse reports, evidence, and dashboards but cannot edit, approve, or consume AI credits. Use them for field staff, partners, board members, and auditors — on Team and Growth they are unlimited and free.",
  },
  {
    q: "What happens to archived projects?",
    a: "Archived projects stay fully readable, searchable, and exportable forever, and they never count against your active-project limit. Only active projects count toward your plan.",
  },
  {
    q: "How do AI credit top-ups work?",
    a: "On Team and Growth you can buy +50 ($79) or +100 ($149) credit packs from the billing page at any time; they draw down after your monthly allowance and never expire mid-month. Growth can also hold a prepaid standing balance so a reporting deadline is never blocked by a hard stop.",
  },
  {
    q: "What does 'bring your own AI provider' mean?",
    a: "Growth and Enterprise workspaces can connect their own LLM provider keys (configured with DonorDesk support). Reports are then drafted with your provider and consume zero DonorDesk AI credits — useful for organizations with existing AI budgets or data-processing requirements.",
  },
  {
    q: "Do you offer nonprofit or regional discounts?",
    a: "Yes. Verified nonprofits receive 25% off paid plans for their first year — Team at $59.25/mo and Growth at $111.75/mo. Submit your NGO registration number and certificate link from Billing settings and our team reviews it, usually within two business days. Eligible organizations registered in lower-income countries can request regional pricing by contacting sales.",
  },
  {
    q: "What happens if I cancel or downgrade?",
    a: "Your data always stays readable, exportable, and deletable on your terms. Downgrading or cancelling never deletes anything; writes that would exceed the free allocation are paused until you upgrade or free up capacity.",
  },
  {
    q: "How is tax handled?",
    a: "Checkout is handled by our Merchant of Record, which calculates and remits sales tax / VAT / GST where applicable and issues compliant invoices.",
  },
];

function renderCell(cell: Cell) {
  if (typeof cell === "string") return cell;
  return cell.text;
}

export default function PricingPage() {
  return (
    <main className="landing-tech min-h-screen overflow-x-hidden bg-slate-950 text-slate-100">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/85 shadow-[0_10px_40px_rgba(2,6,23,0.35)] backdrop-blur-2xl supports-[backdrop-filter]:bg-slate-950/70">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center">
            <Image
              src="/brand/donordesk-logo.png"
              alt="DonorDesk"
              width={552}
              height={600}
              className="h-9 w-auto object-contain"
            />
          </Link>
          <div className="hidden items-center gap-7 text-sm font-medium text-slate-300 lg:flex">
            <Link href="/#features" className="transition hover:text-white">Features</Link>
            <Link href="/#how-it-works" className="transition hover:text-white">How it works</Link>
            <span className="font-semibold text-white">Pricing</span>
            <Link href="/#security" className="transition hover:text-white">Security</Link>
            <Link href="/support" className="text-brand-300 transition hover:text-white">Support</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-200 transition hover:text-white">
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
      <section className="relative isolate px-6 pb-16 pt-20 text-center">
        <div aria-hidden className="tech-orb tech-orb-left" />
        <div aria-hidden className="tech-orb tech-orb-right" />
        <p className="text-sm font-bold uppercase tracking-widest text-brand-300">Plans & pricing</p>
        <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
          Start free. Upgrade when you grow.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
          Every plan includes core donor reporting, the evidence vault with
          Google Drive link-first storage, claim-level provenance, exports, and
          an immutable audit trail.
          {TRIALS_ENABLED
            ? " Paid plans start with a 14-day free trial — no credit card required."
            : " Verified nonprofits get 25% off all paid plans for their first year."}
        </p>
      </section>

      {/* Plan cards */}
      <section className="px-6 pb-20">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2 lg:grid-cols-4">
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
              <h2 className="text-xl font-bold text-white">{plan.name}</h2>
              <p className="mt-1 text-sm text-slate-400">{plan.tagline}</p>
              <div className="mt-5 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-white">{plan.priceLine}</span>
                {plan.code !== "ENTERPRISE" && <span className="text-sm text-slate-400">/ month</span>}
              </div>
              <p className="mt-1 text-xs text-slate-400">{plan.annualLine}</p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm text-slate-300">
                {plan.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-2">
                    <span className="mt-0.5 text-brand-400">✓</span>
                    <span>{benefit}</span>
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
      </section>

      {/* Full comparison table */}
      <section id="compare" className="border-y border-white/10 bg-white/[0.02] px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-brand-300">Full comparison</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Every detail, side by side</h2>
          </div>
          <div className="mt-10 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="bg-white/[0.04] text-xs uppercase tracking-wider text-slate-400">
                  <th scope="col" className="px-5 py-4 font-semibold">Feature</th>
                  <th scope="col" className="px-5 py-4 font-semibold">Free</th>
                  <th scope="col" className="px-5 py-4 font-semibold text-brand-300">Team</th>
                  <th scope="col" className="px-5 py-4 font-semibold">Growth</th>
                  <th scope="col" className="px-5 py-4 font-semibold">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.label} className="border-t border-white/[0.06]">
                    <th scope="row" className="px-5 py-3.5 font-medium text-slate-200">{row.label}</th>
                    {row.cells.map((cell, i) => (
                      <td key={i} className={`px-5 py-3.5 ${i === 1 ? "bg-brand-500/[0.04] text-slate-100" : "text-slate-300"}`}>
                        {renderCell(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-6 text-center text-sm text-slate-400">
            Tax is calculated at checkout where applicable. Annual billing gives two months free.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-brand-300">FAQ</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Pricing questions, answered</h2>
          </div>
          <div className="mt-10 space-y-4">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 open:border-brand-400/30">
                <summary className="cursor-pointer list-none font-semibold text-white marker:hidden">
                  <span className="mr-2 text-brand-400 transition group-open:rotate-90 inline-block" aria-hidden>▸</span>
                  {faq.q}
                </summary>
                <p className="mt-3 pl-6 text-sm leading-relaxed text-slate-300">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-24">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-brand-400/30 bg-gradient-to-br from-brand-600 via-brand-700 to-slate-900 px-6 py-16 text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_-20%,rgba(34,211,238,0.4),transparent)]"
          />
          <h2 className="relative text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Make every reporting period easier than the last
          </h2>
          <p className="relative mx-auto mt-4 max-w-2xl text-lg text-brand-100">
            {TRIALS_ENABLED
              ? "Start free, or trial any paid plan for 14 days. Your data stays yours either way."
              : "Start free, and upgrade when you grow. Your data stays yours either way."}
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
      <footer className="border-t border-white/10 px-6 py-14">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-4">
              <Link href="/" aria-label="DonorDesk home" className="flex items-center">
                <Image
                  src="/brand/donordesk-logo.png"
                  alt="DonorDesk"
                  width={552}
                  height={600}
                  className="h-8 w-auto object-contain"
                />
              </Link>
              <p className="text-sm leading-relaxed text-slate-400">
                Streamline humanitarian donor reporting.
              </p>
              <a
                href="https://www.linkedin.com/company/donordesk-online/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="DonorDesk on LinkedIn"
                className="flex items-center gap-2 text-slate-400 transition hover:text-white"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.065-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
                <span className="text-sm">Follow us on LinkedIn</span>
              </a>
            </div>

            <div>
              <h4 className="font-semibold text-white">Support</h4>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
                <li><Link href="/support" className="transition hover:text-white">Support Home</Link></li>
                <li><Link href="/support#browse" className="transition hover:text-white">All Categories</Link></li>
                <li><Link href="/support/contact" className="transition hover:text-white">Submit a Ticket</Link></li>
                <li><a href="mailto:support@donordesk.online" className="transition hover:text-white">Contact: support@donordesk.online</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white">Product</h4>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
                <li><Link href="/#features" className="transition hover:text-white">Features</Link></li>
                <li><Link href="/pricing" className="text-brand-300 transition hover:text-white">Pricing & plans</Link></li>
                <li><Link href="/#security" className="transition hover:text-white">Security</Link></li>
                <li><a href="mailto:sales@donordesk.online" className="transition hover:text-white">Sales: sales@donordesk.online</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white">Legal</h4>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
                <li><Link href="/privacy" className="transition hover:text-white">Privacy Policy</Link></li>
                <li><Link href="/terms" className="transition hover:text-white">Terms of Service</Link></li>
                <li><Link href="/cookies" className="transition hover:text-white">Cookie Policy</Link></li>
                <li><Link href="/security" className="transition hover:text-white">Security</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} DonorDesk. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-slate-500">
              <Link href="/login" className="transition hover:text-slate-300">Log in</Link>
              <Link href="/signup" className="transition hover:text-slate-300">Get started</Link>
              <Link href="/support" className="transition hover:text-brand-400">Support</Link>
            </div>
          </div>
        </div>
      </footer>
      <CookieConsentBanner />
    </main>
  );
}
