"use client";

import { useState } from "react";
import type { SetupDraftView } from "@/lib/server/schemas-project-setup-draft";
import { NoFixedPlaces } from "./NoFixedPlaces";
import { notUsedAnswer } from "../domain/pcw-view";
import { AcceptAllWaiting } from "./AcceptAllWaiting";
import { OtherPlaces } from "./OtherPlaces";
import { PlacePicker } from "./PlacePicker";
import { CarriedFacts } from "./CarriedFacts";

/**
 * Slide 5: where the project works. One step: tick the country's areas in the list or on the map (ticking an area includes everything
 * inside it) and they are saved to the draft with their parents, ready to be chosen on the Work plan slide. Places that are not areas
 * (a camp, a clinic) and names a document gave that the map did not match are listed below. A project with no fixed places says so.
 */
export function PlacesSlide({ id, view, onView }: { id: string; view: SetupDraftView; onView: (v: SetupDraftView) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [find, setFind] = useState<{ text: string; nonce: number } | null>(null);
  // Offered only while nothing is chosen (or once chosen): a project that has places never needs it.
  const noPlaces = view.places.every((i) => i.status === "REJECTED") || ["places.decided", "places.area"].every((r) => notUsedAnswer(view, r).notUsed);
  return (
    <div className="space-y-8">
      <CarriedFacts view={view} slide="PLACES" />
      <AcceptAllWaiting id={id} area="PLACES" items={view.places} onView={onView} onError={setError} />
      <PlacePicker id={id} view={view} onView={onView} onError={setError} find={find} />
      <OtherPlaces id={id} view={view} onView={onView} onError={setError} onFind={(text) => setFind({ text, nonce: Date.now() })} />
      {noPlaces ? <NoFixedPlaces id={id} view={view} onView={onView} /> : null}
      {error ? <p role="alert" className="text-sm text-danger-600">{error}</p> : null}
    </div>
  );
}
