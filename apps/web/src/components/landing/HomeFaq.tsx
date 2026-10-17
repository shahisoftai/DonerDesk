const FAQS = [
  {
    q: "What is DonorDesk?",
    a: "DonorDesk is a programme management system for grant-funded organisations. You keep the logframe, indicators, activities, evidence and compliance in one record, and donor reports are drafted from that record, checked against it and approved by a person.",
  },
  {
    q: "Is DonorDesk just a reporting tool?",
    a: "No. Reporting is the output. The working system is the logframe, the activity records, the indicator data, the evidence library, the team's queue and the compliance checklist. Those are useful every month, not only at the deadline.",
  },
  {
    q: "Who is DonorDesk for?",
    a: "Local and national NGOs, INGOs, UN implementing partners, consultancies and government programme units that run grant-funded work and report it to donors or funding authorities.",
  },
  {
    q: "Can DonorDesk produce reports for any donor?",
    a: "Yes. You upload the donor's template (Word, PDF, text, Markdown, Excel or CSV). DonorDesk extracts the sections, instructions, required tables and limits. You review and approve them, and the report follows that structure.",
  },
  {
    q: "Does the AI invent numbers?",
    a: "No. Tables, charts and comparisons are built from verified indicator data. A figure in the AI's text that is not in your inputs is rejected and regenerated; if it still fails, the section falls back to plain text that says why. A person approves every report.",
  },
  {
    q: "Can field staff record activities without internet?",
    a: "Partly. A finished activity is kept on the phone or laptop and sent when the connection returns. The DonorDesk app itself needs a connection to open, so it is not a full offline app.",
  },
  {
    q: "Can we keep our evidence in our own Google Drive?",
    a: "Yes. Files can stay in your Google Drive, and linked files do not count toward your managed storage. You can also upload files to DonorDesk managed storage, within your plan's limit.",
  },
  {
    q: "Can I turn AI off?",
    a: "Yes. AI drafting can be switched off in Settings, and you can always write reports manually. Manual writing never uses AI credits.",
  },
  {
    q: "How much does DonorDesk cost?",
    a: "Every workspace starts on the free Starter plan. Paid plans are Team at $79 per month and Growth at $149 per month, Enterprise is contracted, annual billing gives two months free, and verified nonprofits get 25% off for their first year. See the pricing page for full limits.",
  },
  {
    q: "Which export formats are supported?",
    a: "Reports export to Word and PDF, indicator tables and the data sheet to Excel, and evidence packs to ZIP. A watermarked internal copy is available for review at any stage, and a donor submission needs a clean, approved report.",
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
