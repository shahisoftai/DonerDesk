// Not used by the pages that draw a share-link map (their data arrives with the drawing); here so the widget's module bundles.
export async function listPlacesForMapAction() { return { ok: true as const, value: [] }; }
export async function getActivityMapAction() { return { ok: true as const, value: { rows: [] } }; }
