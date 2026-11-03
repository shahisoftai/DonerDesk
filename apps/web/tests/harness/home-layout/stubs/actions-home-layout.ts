// Stand-in for the Home layout actions: records what the editor sends and answers as the scenario says.
type H = { saves: unknown[]; resets: string[]; saveAnswer: { ok: true; value: { updatedAt: string } } | { ok: false; error: { kind: string; message: string } }; refreshes: number };
const h = () => (window as unknown as { __h: H }).__h;
export async function saveHomeLayoutAction(input: unknown) { h().saves.push(input); return h().saveAnswer; }
export async function resetHomeLayoutAction(variant: string) { h().resets.push(variant); return { ok: true as const, value: undefined }; }
