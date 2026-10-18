"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { WikiCategory } from "./WikiLayout";

export function CategoryNav({ categories }: { categories: WikiCategory[] }) {
  const pathname = usePathname();

  return (
    <nav className="sticky top-28 space-y-6">
      {categories.map((cat) => {
        const isActive = pathname.startsWith(`/support/${cat.slug}`);
        return (
          <div key={cat.slug}>
            <Link
              href={`/support/${cat.slug}`}
              className={`flex items-center gap-2.5 text-sm font-medium transition ${
                isActive ? "text-saffron" : "text-paper hover:text-white"
              }`}
            >
              <span className={`rounded-lg p-1 ${isActive ? "bg-saffron/20 text-saffron" : "bg-white/5 text-mist"}`}>
                {cat.icon}
              </span>
              {cat.name}
            </Link>
            {isActive && (
              <ul className="ml-9 mt-2 space-y-1 border-l border-white/10 pl-3">
                {cat.articles.map((art) => {
                  const isArtActive = pathname === art.href;
                  return (
                    <li key={art.href}>
                      <Link
                        href={art.href}
                        className={`block rounded-md px-2 py-1.5 text-xs leading-relaxed transition ${
                          isArtActive
                            ? "border-l-2 border-saffron bg-saffron/10 pl-[6px] text-saffron"
                            : "text-mist hover:text-paper"
                        }`}
                      >
                        {art.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function WikiTopNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-spruce/85 shadow-[0_10px_40px_rgba(2,6,23,0.35)] backdrop-blur-2xl supports-[backdrop-filter]:bg-spruce/70">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center">
          <Image src="/brand/donordesk-logo.png" alt="DonorDesk" width={552} height={600} className="h-9 w-auto object-contain" />
        </Link>
        <div className="hidden items-center gap-7 text-sm font-medium text-mist lg:flex">
          <Link href="/" className="transition hover:text-white">Home</Link>
          <Link href="/pricing" className="transition hover:text-white">Pricing</Link>
          <Link href="/support" className="transition hover:text-white text-saffron">Support</Link>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="rounded-lg px-4 py-2 text-sm font-medium text-paper transition hover:text-white">
            Log in
          </Link>
          <Link href="/support/contact" className="rounded-lg bg-gradient-to-r from-saffron to-saffron px-4 py-2 text-sm font-medium text-spruce shadow-lg shadow-saffron/30 transition hover:from-saffron hover:to-saffron">
            Submit a ticket
          </Link>
        </div>
      </nav>
    </header>
  );
}
