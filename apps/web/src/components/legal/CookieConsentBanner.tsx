"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const COOKIE_NAME = "dd_cookie_consent";
const FIFTEEN_DAYS_SECONDS = 15 * 24 * 60 * 60;

type ConsentChoice = "all" | "essential";

function readConsent(): ConsentChoice | null {
  const value = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${COOKIE_NAME}=`))
    ?.split("=")[1];

  return value === "all" || value === "essential" ? value : null;
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(readConsent() === null);
  }, []);

  function saveConsent(choice: ConsentChoice) {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE_NAME}=${choice}; Max-Age=${FIFTEEN_DAYS_SECONDS}; Path=/; SameSite=Lax${secure}`;
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <aside
      aria-label="Cookie preferences"
      className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-5xl animate-cookie-rise rounded-2xl border border-cyan-300/20 bg-slate-950/95 p-4 shadow-[0_24px_80px_rgba(2,6,23,0.8)] backdrop-blur-2xl sm:p-5"
    >
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2">
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500/15 text-sm text-cyan-200">◉</span>
            <h2 className="font-bold text-white">Your privacy, your choice</h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            We use essential cookies to operate DonorDesk and, with your permission,
            optional analytics cookies to improve it. Your choice expires after 15 days.{" "}
            <Link href="/privacy#cookies" className="font-semibold text-brand-300 underline decoration-brand-400/40 underline-offset-2 hover:text-cyan-200">
              Read our cookie policy
            </Link>
            .
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={() => saveConsent("essential")}
            className="rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/10"
          >
            Essential only
          </button>
          <button
            type="button"
            onClick={() => saveConsent("all")}
            className="rounded-xl bg-gradient-to-r from-brand-500 to-cyan-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-500/25 transition hover:brightness-110"
          >
            Accept all
          </button>
        </div>
      </div>
    </aside>
  );
}
