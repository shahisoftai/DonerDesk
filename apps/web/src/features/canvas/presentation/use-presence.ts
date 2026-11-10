"use client";

import { useEffect, useRef, useState } from "react";
import { updatePresenceAction } from "@/lib/actions/canvas";
import { parsePeers, type Peer } from "../domain/presence";

/**
 * Who else has this canvas open, and a way to say what this person is doing. The stream reconnects by itself; where the browser has no
 * event streams, or the connection cannot be made, the list is simply empty and nothing else changes. The person's own selection is sent
 * after a short pause so a drag does not send a message for every step.
 */
export function usePresence(canvasId: string, selectedBlockId: string | null, editing: boolean): Peer[] {
  const [peers, setPeers] = useState<Peer[]>([]);

  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const source = new EventSource(`/api/canvases/${encodeURIComponent(canvasId)}/presence`);
    const onPresence = (e: MessageEvent<string>) => setPeers(parsePeers(e.data));
    source.addEventListener("presence", onPresence as EventListener);
    return () => { source.removeEventListener("presence", onPresence as EventListener); source.close(); };
  }, [canvasId]);

  const last = useRef<string>("");
  useEffect(() => {
    const key = `${selectedBlockId ?? ""}|${editing}`;
    if (key === last.current) return;
    const timer = window.setTimeout(() => { last.current = key; void updatePresenceAction(canvasId, { blockId: selectedBlockId, editing }); }, 400);
    return () => window.clearTimeout(timer);
  }, [canvasId, selectedBlockId, editing]);

  return peers;
}
