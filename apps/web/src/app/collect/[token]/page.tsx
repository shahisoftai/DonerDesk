import type { Metadata } from "next";
import { apiBaseUrl } from "@/lib/server/api-gateway";
import { PublicCollectForm } from "@/features/collection/presentation/PublicCollectForm";
import type { CollectionFormView } from "@/lib/server/schemas-collection";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Send your answers", robots: { index: false, follow: false } };

/** What a person with a collection link sees: the questions, and a way to send the answers. No sign-in; the link is the credential. */
export default async function CollectPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let form: { name: string; description?: string; fields: CollectionFormView["fields"] } | null = null;
  if (/^[A-Za-z0-9_-]{20,100}$/.test(token)) {
    try {
      const response = await fetch(`${apiBaseUrl()}/public/collect/${encodeURIComponent(token)}`, { cache: "no-store" });
      if (response.ok) form = await response.json();
    } catch {
      form = null;
    }
  }
  if (!form) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">This link is not available</h1>
        <p className="mt-2 text-sm text-slate-500">It may have expired or been withdrawn. Ask the person who sent it for a new one.</p>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">{form.name}</h1>
      {form.description && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{form.description}</p>}
      <div className="mt-6"><PublicCollectForm token={token} fields={form.fields as never} /></div>
    </main>
  );
}
