import type { ReactNode } from "react";

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-12 scroll-mt-24">
      <h2 className="text-2xl font-bold text-white">{title}</h2>
      <div className="mt-4 space-y-4 text-[15px] leading-7 text-slate-300">{children}</div>
    </section>
  );
}

export function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="font-medium text-brand-300 underline decoration-brand-400/40 underline-offset-2 hover:text-brand-200">
      {children}
    </a>
  );
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-white/5 text-slate-200">
          <tr>{head.map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {rows.map((r, i) => (
            <tr key={i} className="align-top">{r.map((c, j) => <td key={j} className="px-4 py-3">{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The policy pages' section: tighter spacing than `Section`, with the anchor offset the table of contents expects. */
export function PolicySection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28">
      <h2 className="text-2xl font-bold tracking-tight text-white">{title}</h2>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-slate-300">{children}</div>
    </section>
  );
}

/** A link in a policy page: the same as `A`, with the hover transition. */
export function PolicyLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="font-medium text-brand-300 underline decoration-brand-400/40 underline-offset-2 transition hover:text-brand-200"
    >
      {children}
    </a>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p>{children}</p>;
}

export function B({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-slate-100">{children}</strong>;
}

export function Ul({ children }: { children: ReactNode }) {
  return <ul className="space-y-2.5 pl-5 marker:text-brand-400 marker:font-bold">{children}</ul>;
}

export function Li({ children }: { children: ReactNode }) {
  return <li className="list-disc">{children}</li>;
}
