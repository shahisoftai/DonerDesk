"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WORKPLAN_COPY, suggestRequiredFiles } from "@donordesk/domain/contexts/workplan/index.js";
import { requirableTypes } from "../domain/file-needs-view";
import { createPlannedActivityAction } from "@/lib/actions/workplan";
import { useActionState } from "@/lib/client/action-state";
import { useHydrated } from "@/lib/client/use-hydrated";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { LocationPickerFigure } from "./LocationPickerFigure";

export interface PlanFormOption { id: string; label: string }

/** Title · Dates · Repeats · Lead · Logframe activity; the rest under "More details". One date makes a milestone. */
export function PlanActivityForm({ projectId, leads, activities, country, customLayerUrl }: { projectId: string; leads: PlanFormOption[]; activities: PlanFormOption[]; country?: string; customLayerUrl?: string }) {
  const router = useRouter();
  const state = useActionState();
  const hydrated = useHydrated();
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [repeat, setRepeat] = useState<"" | "WEEK" | "MONTH">("");
  const [until, setUntil] = useState("");
  const [lead, setLead] = useState("");
  const [node, setNode] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [people, setPeople] = useState("");
  const [sessions, setSessions] = useState("");
  // Files we will need: suggested from the title until the person ticks or unticks anything themselves.
  const [files, setFiles] = useState<string[]>([]);
  const [filesTouched, setFilesTouched] = useState(false);
  // Place suggestions come from the site map's gazetteer, loaded lazily on first use — never in this form's own bundle.
  const [places, setPlaces] = useState<string[]>([]);
  // A hand-placed place when no gazetteer name matches (Phase 30.1).
  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  useEffect(() => {
    const text = location.trim();
    if (text.length < 2) {
      setPlaces([]);
      return;
    }
    let alive = true;
    void import("../domain/site-map")
      .then(({ suggestPlaces }) => {
        if (alive) setPlaces(suggestPlaces(text, country));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [location, country]);
  const logframeTitle = activities.find((a) => a.id === node)?.label;
  const suggested = suggestRequiredFiles(title, logframeTitle);
  const shownFiles = filesTouched ? files : suggested;
  const toggleFile = (id: string, on: boolean) => { const base = filesTouched ? files : suggested; setFilesTouched(true); setFiles(on ? [...new Set([...base, id])] : base.filter((f) => f !== id)); };

  const num = (v: string) => (v.trim() ? Number(v) : undefined);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const out = await state.runCreate((idempotencyKey) =>
      createPlannedActivityAction(projectId, {
        title,
        plannedStart: start,
        plannedEnd: end || start,
        ...(repeat ? { repeats: { every: repeat, until } } : {}),
        ...(lead ? { ownerUserId: lead } : {}),
        ...(node ? { logframeActivityId: node } : {}),
        ...(location.trim() ? { location } : {}),
        ...(pin ? { latitude: pin.latitude, longitude: pin.longitude } : {}),
        ...(description.trim() ? { description } : {}),
        ...(num(people) !== undefined ? { targetParticipants: num(people) } : {}),
        ...(num(sessions) !== undefined ? { targetCount: num(sessions) } : {}),
        ...(shownFiles.length > 0 ? { requiredFiles: shownFiles } : {}),
      }, { idempotencyKey }),
    );
    if (out) router.push(`/projects/${projectId}/activities?view=planned`);
  }

  const err = (k: string) => state.fields?.[k]?.[0];
  return (
    <form onSubmit={submit} className="max-w-xl space-y-4" aria-busy={state.busy}>
      <fieldset disabled={!hydrated || state.busy} className="space-y-4">
        <Field label="Title" error={err("title")}><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts" error={err("plannedStart")}><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} required /></Field>
          <Field label="Ends (leave empty for one day)" description={repeat ? "The end of each repeat, not of the series. Set the last repeat in Until." : undefined} error={err("plannedEnd")}><Input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Repeats" description="Repeating creates one activity for each week or month. Choose the last day in Until.">
            <Select value={repeat} onChange={(e) => setRepeat(e.target.value as "" | "WEEK" | "MONTH")}>
              <option value="">No</option><option value="WEEK">Every week</option><option value="MONTH">Every month</option>
            </Select>
          </Field>
          {repeat && <Field label="Until (last repeat)" error={err("repeats.until")}><Input type="date" value={until} min={start} onChange={(e) => setUntil(e.target.value)} required /></Field>}
        </div>
        <Field label="Lead">
          <Select value={lead} onChange={(e) => setLead(e.target.value)}>
            <option value="">No lead yet</option>
            {leads.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </Select>
        </Field>
        {activities.length > 0 && (
          <Field label="Logframe activity">
            <Select value={node} onChange={(e) => setNode(e.target.value)}>
              <option value="">Not linked</option>
              {activities.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </Select>
          </Field>
        )}
        <details>
          <summary className="cursor-pointer text-sm text-slate-600 dark:text-slate-300">More details</summary>
          <div className="mt-3 space-y-4">
            <Field label="Location">
              <Input list="plan-places" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} />
            </Field>
            {places.length > 0 && (
              <datalist id="plan-places">
                {places.map((place) => (
                  <option key={place} value={place} />
                ))}
              </datalist>
            )}
            {/* A place the gazetteer does not know can be pinned by hand (Phase 30.1). */}
            <div>
              {!pinOpen && !pin && (
                <button type="button" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400" onClick={() => setPinOpen(true)}>
                  {WORKPLAN_COPY.placeOnMap}
                </button>
              )}
              {(pinOpen || pin) && (
                <div className="space-y-2">
                  <LocationPickerFigure
                    value={pin}
                    country={country}
                    customLayerUrl={customLayerUrl}
                    onChange={(next) => {
                      setPin(next);
                      if (next) setPinOpen(true);
                    }}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {pin ? `${pin.latitude}, ${pin.longitude}` : WORKPLAN_COPY.pinHint}
                    </p>
                    {pin && (
                      <button
                        type="button"
                        className="text-sm font-medium text-slate-600 hover:underline dark:text-slate-300"
                        onClick={() => setPin(null)}
                      >
                        {WORKPLAN_COPY.clearPin}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
            <Field label="Notes"><Textarea dictate rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
            <fieldset className="space-y-1">
              <legend className="label">Files we will need</legend>
              <p className="text-xs text-slate-500">Suggested from the activity. Untick any you do not need; nothing is blocked if a file is missing.</p>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {requirableTypes().map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="h-4 w-4" checked={shownFiles.includes(t.id)} onChange={(e) => toggleFile(t.id, e.target.checked)} />{t.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <Field label="People expected" error={err("targetParticipants")}><Input inputMode="numeric" value={people} onChange={(e) => setPeople(e.target.value)} /></Field>
              <Field label="Number of sessions" error={err("targetCount")}><Input inputMode="numeric" value={sessions} onChange={(e) => setSessions(e.target.value)} /></Field>
            </div>
          </div>
        </details>
      </fieldset>
      {state.error && <p role="alert" className="text-sm text-danger-600">{state.error}</p>}
      <Button type="submit" pending={state.busy} disabled={!hydrated}>{WORKPLAN_COPY.addPlanned}</Button>
    </form>
  );
}
