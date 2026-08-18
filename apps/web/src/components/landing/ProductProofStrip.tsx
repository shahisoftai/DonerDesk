"use client";

import type { CSSProperties, PointerEvent } from "react";

const PROOFS = [
  {
    signal: "AI + sources",
    eyebrow: "Traceable drafting",
    title: "Know what supports every claim",
    description: "Drafts draw from your activities, indicator results, and evidence—with statement-level sources kept in view.",
    accent: "proof-blue",
    icon: "✦",
  },
  {
    signal: "Live readiness",
    eyebrow: "Earlier visibility",
    title: "See gaps before the deadline",
    description: "Surface missing evidence, unresolved compliance items, and indicators that still need attention.",
    accent: "proof-cyan",
    icon: "◉",
  },
  {
    signal: "Human approved",
    eyebrow: "Responsible AI",
    title: "Your team stays in control",
    description: "Edit, review, verify, and approve report sections before anything is released to a funder.",
    accent: "proof-violet",
    icon: "✓",
  },
  {
    signal: "4 formats",
    eyebrow: "Ready to deliver",
    title: "Export the way funders expect",
    description: "Produce PDF, DOCX, XLSX, and ZIP deliverables from one structured reporting workspace.",
    accent: "proof-emerald",
    icon: "↗",
  },
];

type SpotlightStyle = CSSProperties & { "--pointer-x": string; "--pointer-y": string };

export function ProductProofStrip() {
  function moveSpotlight(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "touch") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--pointer-x", `${event.clientX - bounds.left}px`);
    event.currentTarget.style.setProperty("--pointer-y", `${event.clientY - bounds.top}px`);
  }

  return (
    <section aria-labelledby="product-proof-title" className="relative border-y border-white/10 bg-slate-950/80 px-6 py-20">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(60%_90%_at_50%_50%,rgba(14,165,233,0.10),transparent_72%)]" />
      <div className="relative mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-300">One connected reporting system</p>
            <h2 id="product-proof-title" className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Less report assembly. More reporting confidence.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-slate-300 md:text-right">
            DonorDesk connects programme delivery to the final report, so your team can move faster without losing oversight or evidence.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PROOFS.map((proof) => (
            <article
              key={proof.signal}
              onPointerMove={moveSpotlight}
              className={`proof-card ${proof.accent}`}
              style={{ "--pointer-x": "50%", "--pointer-y": "50%" } as SpotlightStyle}
            >
              <div className="proof-spotlight" aria-hidden />
              <div className="relative z-10">
                <div className="flex items-center justify-between gap-3">
                  <span className="proof-icon" aria-hidden>{proof.icon}</span>
                  <span className="proof-eyebrow">{proof.eyebrow}</span>
                </div>
                <p className="proof-signal">{proof.signal}</p>
                <h3 className="mt-4 text-lg font-bold text-white">{proof.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{proof.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
