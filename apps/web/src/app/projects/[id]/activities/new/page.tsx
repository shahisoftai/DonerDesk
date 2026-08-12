"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getSessionToken } from "@/lib/session-client";

export default function NewActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [activityTitle, setActivityTitle] = useState("");
  const [activityDate, setActivityDate] = useState("");
  const [location, setLocation] = useState("");
  const [participantsTotal, setParticipantsTotal] = useState("");
  const [participantsMale, setParticipantsMale] = useState("");
  const [participantsFemale, setParticipantsFemale] = useState("");
  const [summary, setSummary] = useState("");
  const [achievements, setAchievements] = useState("");
  const [challenges, setChallenges] = useState("");
  const [lessonsLearned, setLessonsLearned] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const token = getSessionToken();
    if (!token) return router.push("/login");
    setBusy(true); setError(null);
    try {
      await api(`/v1/activities`, {
        method: "POST",
        token,
        body: JSON.stringify({
          projectId: resolvedParams.id,
          reportingPeriodId: "pending-period",
          activityTitle,
          activityDate: new Date(activityDate).toISOString(),
          location: location || undefined,
          participantsTotal: participantsTotal ? Number(participantsTotal) : undefined,
          participantsMale: participantsMale ? Number(participantsMale) : undefined,
          participantsFemale: participantsFemale ? Number(participantsFemale) : undefined,
          summary,
          achievements,
          challenges,
          lessonsLearned,
          nextSteps,
        }),
      });
      router.push(`/projects/${resolvedParams.id}/activities`);
    } catch (e) { setError((e as { message?: string }).message ?? "Failed"); } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-3xl animate-fade-in px-6 py-8">
      <h1 className="text-2xl font-bold">New activity update</h1>
      <form onSubmit={submit} className="card mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Activity title"><input className="input" value={activityTitle} onChange={(e) => setActivityTitle(e.target.value)} required /></Field>
        <Field label="Date"><input className="input" type="date" value={activityDate} onChange={(e) => setActivityDate(e.target.value)} required /></Field>
        <Field label="Location"><input className="input" value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
        <Field label="Total participants"><input className="input" type="number" value={participantsTotal} onChange={(e) => setParticipantsTotal(e.target.value)} /></Field>
        <Field label="Male"><input className="input" type="number" value={participantsMale} onChange={(e) => setParticipantsMale(e.target.value)} /></Field>
        <Field label="Female"><input className="input" type="number" value={participantsFemale} onChange={(e) => setParticipantsFemale(e.target.value)} /></Field>
        <div className="sm:col-span-2"><label className="label">Summary</label><textarea className="input min-h-[80px]" value={summary} onChange={(e) => setSummary(e.target.value)} required /></div>
        <div className="sm:col-span-2"><label className="label">Achievements</label><textarea className="input" value={achievements} onChange={(e) => setAchievements(e.target.value)} /></div>
        <div className="sm:col-span-2"><label className="label">Challenges</label><textarea className="input" value={challenges} onChange={(e) => setChallenges(e.target.value)} /></div>
        <div className="sm:col-span-2"><label className="label">Lessons learned</label><textarea className="input" value={lessonsLearned} onChange={(e) => setLessonsLearned(e.target.value)} /></div>
        <div className="sm:col-span-2"><label className="label">Next steps</label><textarea className="input" value={nextSteps} onChange={(e) => setNextSteps(e.target.value)} /></div>
        {error && <p className="text-sm text-red-600 dark:text-red-400 sm:col-span-2">{error}</p>}
        <div className="sm:col-span-2 flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => router.back()}>Cancel</button>
          <button className="btn" disabled={busy}>{busy ? "Saving..." : "Submit activity"}</button>
        </div>
      </form>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="label">{label}</label>{children}</div>;
}
