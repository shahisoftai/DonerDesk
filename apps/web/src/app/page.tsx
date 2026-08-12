import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="flex items-center justify-between">
        <div className="text-2xl font-bold text-brand-700">DonorDesk</div>
        <div className="flex gap-3">
          <Link className="btn-secondary" href="/login">Log in</Link>
          <Link className="btn" href="/signup">Get started</Link>
        </div>
      </header>

      <section className="mt-16">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          From scattered field evidence to donor-ready reports.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-600">
          DonorDesk turns messy field evidence, activity notes, and logframe data into
          audit-ready donor reports with source-linked AI drafting and a live compliance
          checklist.
        </p>
        <div className="mt-8 flex gap-3">
          <Link className="btn" href="/signup">Create a free workspace</Link>
          <Link className="btn-secondary" href="/login">Log in</Link>
        </div>
      </section>

      <section className="mt-20 grid gap-6 sm:grid-cols-3">
        <div className="card">
          <h3 className="font-semibold">Donor template extraction</h3>
          <p className="mt-2 text-sm text-slate-600">
            Upload a donor template and DonorDesk structures it into editable sections
            with required evidence.
          </p>
        </div>
        <div className="card">
          <h3 className="font-semibold">AI-assisted drafting</h3>
          <p className="mt-2 text-sm text-slate-600">
            Every AI-generated paragraph carries source references to verified evidence
            and indicator data. No black-box text.
          </p>
        </div>
        <div className="card">
          <h3 className="font-semibold">Compliance checklist</h3>
          <p className="mt-2 text-sm text-slate-600">
            A live readiness score surfaces missing evidence, unverified indicators, and
            late activity updates before submission.
          </p>
        </div>
      </section>
    </main>
  );
}
