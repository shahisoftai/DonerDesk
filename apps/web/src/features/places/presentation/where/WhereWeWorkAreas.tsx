"use client";

import { useState } from "react";
import type { ProjectPlacesDto } from "@/lib/server/schemas-place-tree";
import { ProjectAreaPicker } from "../ProjectAreaPicker";
import { ProjectAreasList } from "./ProjectAreasList";

/** The Areas tab (Phase 56): the map to tick areas and the list to close or reopen them. A refused untick opens that area's "Close" form. */
export function WhereWeWorkAreas({ projectId, country, data }: { projectId: string; country: string; data: ProjectPlacesDto }) {
  const [closeFor, setCloseFor] = useState<string | null>(null);
  const areas = data.areas.map((a) => ({ id: a.id, name: a.name, adminLevel: a.adminLevel, code: a.code ?? null, archived: false }));
  return (
    <div className="space-y-6">
      <ProjectAreaPicker projectId={projectId} initialCountry={country} areas={areas} canEdit={data.canEdit} onRefused={(placeId) => setCloseFor(placeId)} />
      <ProjectAreasList key={closeFor ?? "none"} projectId={projectId} areas={data.areas} canEdit={data.canEdit} closeFor={closeFor} />
    </div>
  );
}
