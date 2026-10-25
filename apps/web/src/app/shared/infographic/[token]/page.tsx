import type { Metadata } from "next";
import { apiBaseUrl } from "@/lib/server/api-gateway";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shared infographic", robots: { index: false, follow: false } };

interface Info {
  title: string;
  format?: string;
  altText?: string | null;
  expiresAt?: string;
}

/** What a person with a share link sees: the infographic, its description, and a download. No sign-in; the link is the credential. */
export default async function SharedInfographicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let info: Info | null = null;
  if (/^[A-Za-z0-9_-]{20,100}$/.test(token)) {
    try {
      const response = await fetch(`${apiBaseUrl()}/public/infographics/${encodeURIComponent(token)}/info`, { cache: "no-store" });
      if (response.ok) info = (await response.json()) as Info;
    } catch {
      info = null;
    }
  }
  if (!info) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">This link is not available</h1>
        <p className="mt-2 text-sm text-slate-500">It may have expired or been withdrawn. Ask the person who sent it for a new one.</p>
      </main>
    );
  }
  const file = `/api/shared-infographic/${encodeURIComponent(token)}`;
  const isImage = info.format === "PNG" || info.format === "SVG";
  const expires = info.expiresAt ? new Date(info.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : undefined;
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">{info.title}</h1>
      {info.altText && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{info.altText}</p>}
      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={file} alt={info.altText ?? info.title} className="h-auto w-full" />
        ) : (
          <p className="p-6 text-sm text-slate-600">This file opens in your viewer or downloads when you choose “Download”.</p>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <a className="btn-primary" href={file} download>
          Download
        </a>
        {expires && <span className="text-xs text-slate-500">This link works until {expires}.</span>}
      </div>
    </main>
  );
}
