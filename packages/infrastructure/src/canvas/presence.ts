import { InMemoryPresence } from "@donordesk/application";

/**
 * The one presence registry of this process (Phase 48.8). It lives beside the data versions: in memory, forgotten on restart (every open page
 * reconnects and says again). A sweep every few seconds drops entries nobody refreshed, and does not keep the process alive.
 */
export const processPresence = new InMemoryPresence();
const sweeper = setInterval(() => { processPresence.sweep(); }, 15_000);
sweeper.unref?.();
