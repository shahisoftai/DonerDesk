import Link from "next/link";
import Image from "next/image";

// Shared header for the public marketing pages (home and /features).
// Section links on the home page use "/#id" so they also work from other pages.
export function MarketingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-spruce/85 shadow-[0_10px_40px_rgba(2,6,23,0.35)] backdrop-blur-2xl supports-[backdrop-filter]:bg-spruce/70">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center">
          <Image
            src="/brand/donordesk-logo.png"
            alt="DonorDesk"
            width={552}
            height={600}
            className="h-9 w-auto object-contain"
            sizes="128px"
          />
        </Link>
        <div className="hidden items-center gap-7 text-sm font-medium text-mist lg:flex">
          <Link href="/features" className="transition hover:text-white">Features</Link>
          <Link href="/#how-it-works" className="transition hover:text-white">How it works</Link>
          <Link href="/#who-its-for" className="transition hover:text-white">Who it&apos;s for</Link>
          <Link href="/pricing" className="transition hover:text-white">Pricing</Link>
          <Link href="/security" className="transition hover:text-white">Security</Link>
          <Link href="/support" className="text-saffron transition hover:text-white">Support</Link>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-paper transition hover:text-white"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-gradient-to-r from-saffron to-saffron px-4 py-2 text-sm font-semibold text-spruce shadow-lg shadow-saffron/30 transition hover:from-saffron hover:to-saffron"
          >
            Get started
          </Link>
        </div>
      </nav>
    </header>
  );
}
