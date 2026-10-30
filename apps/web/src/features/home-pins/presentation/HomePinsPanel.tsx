import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { HomePinListSchema } from "@/lib/server/schemas-home-pins";
import { PinControls } from "./PinControls";

/** The person's pinned tiles on their Home. Hidden when they have none (the "Pin to Home" button on a dashboard is how one is made). */
export async function HomePinsPanel() {
  const ctx = await requireSession();
  const r = await gatewayRequest("/v1/home-pins", HomePinListSchema, ctx.token);
  if (!r.ok || r.value.pins.length === 0) return null;
  const pins = r.value.pins;
  const own = pins.filter((p) => !p.shared);
  return (
    <section aria-label="Your pinned dashboards" className="min-w-0">
      <h2 className="text-sm font-medium">Pinned to your Home</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {pins.map((p) => (
          <li key={p.id} className="card flex min-w-0 flex-col gap-2">
            <Link href={p.href} className={`block min-w-0 ${p.available ? "" : "text-slate-500"}`}>
              <span className="block truncate text-sm font-medium hover:underline">{p.title}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">{p.detail}</span>
            </Link>
            {p.shared ? <span className="text-xs text-slate-500">Shown to everyone</span> : <PinControls id={p.id} title={p.title} index={own.findIndex((x) => x.id === p.id)} count={own.length} />}
          </li>
        ))}
      </ul>
    </section>
  );
}
