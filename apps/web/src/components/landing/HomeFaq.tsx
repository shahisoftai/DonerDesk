const FAQS = [
  {
    q: "What is DonorDesk?",
    a: "DonorDesk is a platform that helps NGOs and grant-funded organisations prepare donor reports faster. It links your logframe, indicators, activities and evidence to an AI-assisted, fact-checked report that you edit like a document.",
  },
  {
    q: "Who is DonorDesk for?",
    a: "Local and national NGOs, INGOs, UN implementing partners, consultancies and government programme units that report to donors and funding authorities.",
  },
  {
    q: "Can DonorDesk produce reports for any donor?",
    a: "Yes. You upload the donor's template (Word, PDF, text, Markdown, Excel or CSV). DonorDesk extracts the outline and rules, you review and approve them, and the report follows that structure.",
  },
  {
    q: "Does the AI invent numbers?",
    a: "No. Tables, charts and comparisons are built from verified indicator data, and any figure in the AI's text that is not in your inputs is rejected. Every factual statement is checked against your evidence, and a person approves the final report.",
  },
  {
    q: "Can I turn AI off?",
    a: "Yes. AI drafting can be switched off in Settings and you can always write reports manually.",
  },
  {
    q: "How much does DonorDesk cost?",
    a: "Every workspace starts on the free Starter plan. Paid plans are Team at $129 per month and Growth at $299 per month, Enterprise is contracted, annual billing gives two months free, and verified nonprofits get 40% off. See the pricing page for full limits.",
  },
  {
    q: "Which export formats are supported?",
    a: "Reports export to Word and PDF, indicator tables to Excel, and evidence packs to ZIP, with review and approval gates before release.",
  },
  {
    q: "Can DonorDesk submit reports to donors directly?",
    a: "No. You export the approved report and send or upload it to the donor yourself.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export function HomeFaq() {
  return (
    <section id="faq" className="px-6 py-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">FAQ</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Frequently asked questions
          </h2>
        </div>
        <div className="mt-10 divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.02]">
          {FAQS.map((f) => (
            <details key={f.q} className="group px-6 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-white">
                {f.q}
                <span aria-hidden className="text-brand-300 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
