import Link from "next/link";
import Image from "next/image";

// Shared footer for the public marketing pages.
export function MarketingFooter() {
  return (
    <footer className="border-t border-white/10 px-6 py-14">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="flex flex-col gap-4 lg:col-span-1">
            <Link href="/" aria-label="DonorDesk home" className="flex items-center rounded-lg transition hover:opacity-85">
              <Image
                src="/brand/donordesk-logo.png"
                alt="DonorDesk"
                width={552}
                height={600}
                className="h-8 w-auto object-contain"
                sizes="112px"
              />
            </Link>
            <p className="text-sm leading-relaxed text-slate-400">
              Run your programme. Report from the record.
            </p>
            <a
              href="https://www.linkedin.com/company/donordesk-online/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="DonorDesk on LinkedIn"
              className="flex items-center gap-2 text-slate-400 transition hover:text-white"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              <span className="text-sm">Follow us on LinkedIn</span>
            </a>
          </div>

          <div>
            <h4 className="font-semibold text-white">Platform</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
              <li><Link href="/features" className="transition hover:text-white">Features</Link></li>
              <li><Link href="/pricing" className="transition hover:text-white">Pricing</Link></li>
              <li><Link href="/tour" className="transition hover:text-white">Product tour</Link></li>
              <li><Link href="/contact-sales" className="transition hover:text-white">Contact sales</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white">Support</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
              <li><Link href="/support" className="transition hover:text-white">Support Home</Link></li>
              <li><Link href="/support#browse" className="transition hover:text-white">All Categories</Link></li>
              <li><Link href="/support/contact" className="transition hover:text-white">Submit a Ticket</Link></li>
              <li><a href="mailto:support@donordesk.online" className="transition hover:text-white">support@donordesk.online</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-amber-400">Report Writing Skills</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
              <li><Link href="/support/report-writing-skills/report-writing-fundamentals" className="transition hover:text-white">Report Writing Fundamentals</Link></li>
              <li><Link href="/support/reference-donor-reporting-guidelines" className="transition hover:text-white">Donor Requirements Index</Link></li>
              <li><Link href="/support/report-writing-skills/pre-report-checklist" className="transition hover:text-white">Pre-Report Checklist</Link></li>
              <li><Link href="/support/report-writing-skills/narrative-structure" className="transition hover:text-white">Progress Report Guide</Link></li>
              <li><Link href="/support/report-writing-skills/donor-comparison" className="transition hover:text-white">Final Report Guide</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white">Legal</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
              <li><Link href="/privacy" className="transition hover:text-white">Privacy Policy</Link></li>
              <li><Link href="/terms" className="transition hover:text-white">Terms of Service</Link></li>
              <li><Link href="/cookies" className="transition hover:text-white">Cookie Policy</Link></li>
              <li><Link href="/security" className="transition hover:text-white">Security</Link></li>
              <li><Link href="/dpa" className="transition hover:text-white">Data Processing Agreement</Link></li>
              <li><Link href="/subprocessors" className="transition hover:text-white">Subprocessors</Link></li>
              <li><Link href="/acceptable-use" className="transition hover:text-white">Acceptable Use</Link></li>
              <li><Link href="/refunds" className="transition hover:text-white">Refunds &amp; Cancellation</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 border-t border-white/10 pt-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} DonorDesk. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
