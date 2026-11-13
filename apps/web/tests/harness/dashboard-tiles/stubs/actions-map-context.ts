// Map context and analysis are not part of what the tiles harness checks: they answer "nothing offered".
export async function getMapContextAction() { return { ok: false as const, error: { message: "not in this harness", code: "UNAVAILABLE", referenceId: "" } }; }
export async function saveMapContextAction() { return { ok: false as const, error: { message: "not in this harness", code: "UNAVAILABLE", referenceId: "" } }; }
export async function populationWithinAction() { return { ok: false as const, error: { message: "not in this harness", code: "UNAVAILABLE", referenceId: "" } }; }
