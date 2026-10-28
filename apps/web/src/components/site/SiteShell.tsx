"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LocaleSwitcher } from "@/features/i18n/presentation/LocaleSwitcher";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { SITE_FONT_CLASSES } from "./fonts";
import "./site.css";

const THEME_KEY = "dd-site-theme";

const MENU: Array<{ key: string; href: string; match: (p: string) => boolean }> = [
  { key: "site.nav.platform", href: "/platform", match: (p) => p === "/platform" },
  { key: "site.nav.features", href: "/features", match: (p) => p === "/features" },
  { key: "site.nav.solutions", href: "/solutions", match: (p) => p.startsWith("/solutions") },
  { key: "site.nav.pricing", href: "/pricing", match: (p) => p === "/pricing" },
  { key: "site.nav.compare", href: "/compare", match: (p) => p === "/compare" },
  { key: "site.nav.resources", href: "/support", match: (p) => p.startsWith("/support") },
  { key: "site.nav.security", href: "/security", match: (p) => p === "/security" },
];

function Logo() {
  return (
    <Link className="sx-logo" href="/" aria-label="DonorDesk home">
      <i aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 18V9M10 18V5M16 18v-7M21 18H3" /></svg></i>
      DonorDesk
    </Link>
  );
}

/** The light-first public site frame: header with the language switcher and a theme choice, then the page, then the footer. */
export function SiteShell({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname() ?? "/";
  const [dark, setDark] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try { if (window.localStorage.getItem(THEME_KEY) === "dark") setDark(true); } catch { /* light stays */ }
  }, []);
  function toggleTheme() {
    setDark((d) => {
      const next = !d;
      try { window.localStorage.setItem(THEME_KEY, next ? "dark" : "light"); } catch { /* the choice still applies to this visit */ }
      return next;
    });
  }

  return (
    <div className={`sx ${SITE_FONT_CLASSES}`} data-sx-theme={dark ? "dark" : "light"}>
      <a className="sx-skip" href="#main">Skip to content</a>
      <div className="sx-header-wrap">
        <header className="sx-top">
          <div className="sx-wrap sx-nav">
            <Logo />
            <nav className="sx-menu" aria-label="Main">
              {MENU.map((m) => <Link key={m.href} href={m.href} aria-current={m.match(pathname) ? "page" : undefined}>{t(m.key)}</Link>)}
            </nav>
            <div className="sx-tools">
              <LocaleSwitcher className="sx-lang" />
              <button type="button" className="sx-chip-btn" onClick={toggleTheme} aria-pressed={dark} aria-label={t("site.nav.theme")}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{dark ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></> : <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />}</svg></button>
              <Link className="sx-btn sx-ghost sx-small sx-hide-s" href="/login">{t("site.nav.login")}</Link>
              <Link className="sx-btn sx-primary sx-small sx-hide-xs" href="/signup">{t("site.nav.start")}</Link>
              <button type="button" className="sx-chip-btn sx-burger" aria-expanded={open} aria-label={t("site.nav.menu")} onClick={() => setOpen((o) => !o)}>☰</button>
            </div>
          </div>
          <div className="sx-wrap">
            <div className={`sx-mobile-menu${open ? " sx-open" : ""}`}>
              {MENU.map((m) => <Link key={m.href} href={m.href} onClick={() => setOpen(false)}>{t(m.key)}</Link>)}
              <Link href="/login" onClick={() => setOpen(false)}>{t("site.nav.login")}</Link>
              <Link href="/signup" onClick={() => setOpen(false)}><b>{t("site.nav.start")}</b></Link>
            </div>
          </div>
        </header>
      </div>
      <main id="main">{children}</main>
      {footer}
    </div>
  );
}
